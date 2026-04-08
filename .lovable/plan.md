## Plan d'implémentation

### 1. 📧 Configuration email avec le domaine laces.fr
- Configurer le domaine email Lovable avec `laces.fr`
- L'adresse d'expédition sera `info@laccess.fr`
- Remplacer SendGrid par l'infrastructure email intégrée de Lovable
- Mettre à jour l'Edge Function d'envoi de tickets

### 2. 📬 Regroupement des QR codes dans un seul email
- Modifier l'envoi pour qu'une réservation de groupe (ex: 10 personnes) génère **un seul email** contenant tous les QR codes individuels
- Chaque QR code affichera le nom de la personne associée

### 3. 🔍 Filtres et export de données dans l'admin
- Ajouter des filtres dans le tableau admin : par **date**, **email**, **nom**
- Ajouter un bouton d'export CSV filtré
- Interface de recherche intuitive avec champs combinables

### 4. 🔔 Alertes en temps réel lors du scan
- Créer une table `scan_notifications` pour stocker les alertes
- Activer Realtime sur cette table (les notifications ne contiennent pas de données sensibles)
- Quand un agent scanne un QR code → une notification est créée automatiquement
- Les admins et serveuses voient un **popup/toast en temps réel** avec le prénom de la personne
- **Note sur les notifications push** : les notifications push natives nécessitent un service worker (PWA) qui peut causer des problèmes dans l'éditeur Lovable. Je recommande de commencer par les alertes in-app en temps réel, puis d'ajouter les push notifications dans un second temps si nécessaire.

### Ordre d'exécution
1. Configuration email (domaine)
2. Regroupement QR codes
3. Filtres et export
4. Alertes temps réel
