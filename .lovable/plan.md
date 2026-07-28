# Implémentation Wallet Passes — Cartes membres L'Access

## Objectif
Permettre aux clients d’ajouter leur carte membre L'Access dans Apple Wallet et Google Wallet depuis la page publique `/carte/:uid`.

## Prérequis à récupérer

### 🍎 Apple Wallet
1. Créer un **Pass Type ID** dans Apple Developer (ex. `pass.fr.laccess.membercard`).
2. Générer un **certificat** associé au Pass Type ID.
3. Télécharger le certificat `.cer`, l’ouvrir dans l’**Trousseau d’accès**, puis l’exporter en **.p12** avec un mot de passe.
4. Télécharger le certificat **Apple WWDR** (G4 actuellement).
5. Fournir :
   - Pass Type ID
   - Fichier `.p12` (certificat + clé privée)
   - Mot de passe du `.p12`
   - Certificat WWDR
   - Team ID (déjà connu : `DYTZ2TL65R`)

### 🔵 Google Wallet
1. Activer **Google Wallet API** dans Google Cloud / Pay & Wallet Console.
2. Créer un compte de service, télécharger le **JSON**.
3. Créer une **Generic Class** et récupérer :
   - Issuer ID
   - Class ID

## Implémentation technique

### Backend (Edge Function Deno)
- Créer `supabase/functions/generate-wallet-pass/index.ts`.
- Importer `npm:passkit-generator` pour générer le `.pkpass` signé.
- Valider le JWT staff/authenticated avant génération (sécurité).
- Lire les secrets via `vault.decrypted_secrets` :
  - `APPLE_WALLET_PASS_TYPE_ID`
  - `APPLE_WALLET_CERTIFICATE_P12` (base64)
  - `APPLE_WALLET_CERTIFICATE_PASSWORD`
  - `APPLE_WALLET_WWDR` (base64)
  - `GOOGLE_WALLET_ISSUER_ID`
  - `GOOGLE_WALLET_CLASS_ID`
  - `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON`
- Endpoint acceptant `{ uid, platform: 'apple' | 'google' }`.
- Pour Apple : retourner le `.pkpass` en `application/vnd.apple.pkpass`.
- Pour Google : créer/signer un JWT via l’API Google Wallet et rediriger/retourner l’URL d’ajout.

### Base de données
- Ajouter un champ `pass_url` ou utiliser une table `wallet_passes` si historisation nécessaire.
- S’assurer que seul le staff peut générer un pass (pas de génération anonyme).

### Frontend
- Activer les boutons "Ajouter à Apple Wallet" et "Ajouter à Google Wallet" sur `/carte/:uid`.
- Appeler l’Edge Function au clic.
- Gérer le téléchargement automatique du `.pkpass` et l’ouverture du lien Google Wallet.

## Déploiement
- Stocker les secrets via l’interface Lovable Cloud.
- Déployer l’Edge Function.
- Publier le frontend.

## Prochaine étape immédiate
Fournir les prérequis Apple/Google listés ci-dessus pour finaliser l’intégration.