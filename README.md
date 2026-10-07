# I'm Nobody's Fool

The website for [imnobodysfool.com](https://imnobodysfool.com): free three-minute practice rounds that teach people to spot scam texts.

- `index.html` is the home page.
- `emergency-call.html` is the first training (7 fixed questions).
- `quiz.html` is the practice test (10 questions chosen to match the player's level).
- `caught.html` is where links in inbox-test emails lead.
- `account.html` is sign-in and the My Results page.
- `privacy.html` explains what is recorded.
- `assets/questions.js` holds every scenario. Add or edit questions there.
- `assets/engine.js` runs the tests. `assets/config.js` holds the database connection.
- `setup/supabase-setup.sql` creates the database tables. `setup/supabase-accounts.sql` adds sign-in and is run after it.
- `CNAME` tells GitHub Pages the site's address.
