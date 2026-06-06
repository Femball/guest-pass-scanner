## Objectif

1. Permettre, dans l'admin, de sélectionner plusieurs clients ayant réservé pour une soirée donnée et leur renvoyer le SMS du ticket QR (un par un, via l'app SMS native).
2. Mettre en place une vraie base de données `clients` (nom, téléphone, email, notes, historique) auto-alimentée par les réservations, avec gestion manuelle.

Le SMS reste envoyé via le schéma `sms:` natif (pas de Twilio). Comme iOS/Android n'ouvrent qu'un SMS à la fois et exigent un geste utilisateur, l'envoi multiple se fait sous forme de file d'attente : un dialogue affiche le client courant, l'admin clique "Ouvrir SMS", envoie, puis clique "Suivant" pour passer au client suivant — sécurité anti-double-envoi déjà appliquée dans l'app.

## 1. Base de données

Nouvelle table `public.clients` :
- `name`, `phone` (unique, normalisé), `email`, `notes`
- `first_seen_at`, `last_seen_at`, `reservation_count`

Trigger sur `reservations` (INSERT/UPDATE) : upsert dans `clients` en utilisant le téléphone (ou email à défaut) comme clé. Met à jour `last_seen_at` et incrémente `reservation_count`.

RLS : lecture/écriture limitées au staff (admin/agent/supervisor) via `is_staff(auth.uid())`. GRANT sur `authenticated` + `service_role`.

## 2. Multi-SMS dans l'onglet d'une soirée

Dans chaque onglet "soirée" du tableau des réservations :
- Bouton "Envoyer SMS à plusieurs" (visible quand au moins une réservation a un téléphone).
- Ouvre un dialogue listant les réservations de la soirée avec téléphone.
- Cases à cocher (avec "Tout sélectionner") + recherche par nom.
- Bouton "Lancer l'envoi" → ouvre la file d'attente :
  - Affiche "Client X sur N — Jean Dupont (+33…)"
  - Bouton "Ouvrir SMS" (génère le corps avec QR via `buildTicketSmsBody` existant, lance le schéma `sms:`)
  - Bouton "Suivant" (étape suivante)
  - Bouton "Passer" (skip)
  - Progression visible

## 3. Gestion manuelle des clients

Le dialogue "Répertoire clients" existant est branché sur la nouvelle table `clients` (au lieu d'être déduit côté front) :
- Affiche nom / téléphone / email / nb réservations / dernière venue / notes
- Bouton "Ajouter un client" (formulaire nom + téléphone + email + notes)
- Bouton "Modifier" sur chaque ligne (édite tous les champs)
- Bouton "Supprimer" (avec confirmation)
- Recherche existante conservée + export CSV étendu avec les nouvelles colonnes

## Détails techniques

- Migration SQL :
  - Création table `clients`, GRANTs, RLS via `is_staff`
  - Fonction trigger `sync_client_from_reservation()` (SECURITY DEFINER, `search_path=public`)
  - Trigger AFTER INSERT/UPDATE OF client_phone, client_email, client_name ON reservations
  - Backfill initial à partir des réservations existantes
- `src/pages/Admin.tsx` :
  - Hook + state pour `clients[]`, fetch via supabase, polling 10 s comme le reste
  - Nouveau composant `BulkSmsDialog` (sélection + file)
  - Refonte du `clientsDialog` pour CRUD réel sur la table
- Aucune nouvelle dépendance, pas de framer-motion, animations Tailwind natives.
