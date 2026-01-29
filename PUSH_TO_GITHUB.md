# Publier sur GitHub

## Méthode 1 : Ligne de commande

```bash
# 1. Ajouter le remote (remplace TON_USERNAME par ton pseudo GitHub)
git remote add origin https://github.com/TON_USERNAME/TransactionMail.git

# 2. Renommer la branche en main
git branch -M main

# 3. Pousser vers GitHub
git push -u origin main
```

## Méthode 2 : GitHub Desktop

1. Ouvre GitHub Desktop
2. File → Add local repository
3. Sélectionne le dossier `D:\Kimi Code`
4. Publie le repository

## Méthode 3 : VS Code

1. Ouvre VS Code dans le dossier
2. Onglet Source Control (Ctrl+Shift+G)
3. Clique sur "Publish to GitHub"

---

## Après le push

Une fois poussé, ton repo sera accessible sur :
```
https://github.com/TON_USERNAME/TransactionMail
```

## Cloner ailleurs

Pour récupérer le projet sur une autre machine :
```bash
git clone https://github.com/TON_USERNAME/TransactionMail.git
cd TransactionMail
pnpm install
pnpm db:generate
```
