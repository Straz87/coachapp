# Guida setup e pubblicazione — Coach App

Questa è la tua app di coaching: tu (trainer) gestisci i clienti, assegni schede di
allenamento, piano alimentare, segui i progressi e chatti con loro. Nessun
marketplace, nessun pagamento in-app: gli abbonamenti li gestisci tu come già fai,
l'app tiene solo traccia di stato/scadenza/prezzo.

Segui questi passaggi in ordine. Non serve saper programmare, sono tutti click su
interfacce web. Se ti blocchi in un punto, torna qui in chat e dimmi a che passo
sei — ti aiuto a sbloccarti.

---

## 1. Crea il progetto Supabase (database + login)

1. Vai su https://supabase.com e crea un account gratuito (con Google o email).
2. Clicca **New project**. Scegli un nome (es. "coachapp"), una password per il
   database (salvala da qualche parte) e una regione vicina a te (es. Frankfurt).
3. Aspetta 1-2 minuti che il progetto sia pronto.
4. Nel menu a sinistra vai su **SQL Editor** → **New query**.
5. Apri il file `supabase/schema.sql` di questo progetto, copia tutto il
   contenuto, incollalo nell'editor SQL di Supabase e premi **Run**.
   Questo crea tutte le tabelle e le regole di sicurezza.
6. Vai su **Storage** (menu a sinistra) → **Create a new bucket**.
   - Nome: `progress-photos`
   - Spunta **Public bucket** (così le foto progressi si vedono nell'app)
   - Crea.
7. Vai su **Project Settings** (icona ingranaggio) → **API**. Qui trovi:
   - **Project URL** → sarà `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → sarà `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (sotto "Project API keys", clicca "Reveal") →
     sarà `SUPABASE_SERVICE_ROLE_KEY`. **Non condividerla mai, è una chiave
     amministrativa.**

---

## 2. Crea il tuo account trainer

Il tuo account (Domenico, il coach) va creato manualmente una volta sola, in
Supabase:

1. Vai su **Authentication** → **Users** → **Add user** → **Create new user**.
2. Inserisci la tua email e una password a tua scelta. Spunta **Auto Confirm User**.
3. Copia lo **User UID** appena creato (una stringa tipo `a1b2c3...`).
4. Vai di nuovo su **SQL Editor** → **New query** e incolla (sostituendo i
   valori tra `< >`):

```sql
insert into profiles (id, role, full_name, email)
values ('<INCOLLA-QUI-USER-UID>', 'trainer', 'Domenico Strazzullo', '<LA-TUA-EMAIL>');
```

5. Premi **Run**. Ora puoi accedere all'app con quella email/password come trainer.

---

## 3. Prova l'app in locale (facoltativo ma consigliato)

Se hai Node.js installato sul computer:

1. Apri il terminale nella cartella `coachapp`.
2. Copia `.env.example` in un nuovo file chiamato `.env.local` e incolla i
   3 valori presi al punto 1.7.
3. Esegui:
   ```
   npm install
   npm run dev
   ```
4. Apri http://localhost:3000 e accedi con l'account trainer creato al punto 2.

---

## 4. Pubblica l'app online con Vercel (gratis)

1. Crea un account su https://vercel.com (puoi usare GitHub per accedere).
2. Se non l'hai già fatto, carica la cartella `coachapp` su un repository
   GitHub (posso aiutarti anche con questo passaggio, dimmelo).
3. Su Vercel: **Add New** → **Project** → importa il repository.
4. Nella schermata di configurazione, apri **Environment Variables** e aggiungi
   le stesse 3 variabili di `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Clicca **Deploy**. Dopo 1-2 minuti avrai un link tipo
   `https://coachapp-tuonome.vercel.app` — è la tua app, online, raggiungibile
   da te e dai tuoi clienti.

---

## 5. Aggiungi i tuoi clienti

1. Accedi all'app come trainer.
2. Vai su **Clienti → + Nuovo cliente**, inserisci nome, email, prezzo e
   scadenza abbonamento.
3. L'app ti mostrerà email + password temporanea da mandare al cliente (es. via
   WhatsApp). Con quelle credenziali il cliente accede alla sua area.
4. Da lì puoi assegnargli allenamenti dal **Calendario**, un piano alimentare, e
   scrivergli in **Messaggi**.

---

## Cosa NON include ancora questa prima versione

- Pagamenti in-app (li gestisci tu fuori dall'app, come concordato)
- Notifiche push/email quando arriva un messaggio o un nuovo allenamento
- Possibilità per il cliente di cambiare la propria password dall'app (per ora
  va fatto da Supabase, o aggiungiamo questa funzione dopo)
- App nativa iOS/Android (è una web app: funziona da browser su telefono, e il
  cliente può "aggiungerla alla schermata Home" per usarla come un'app)

Sono tutte cose che possiamo aggiungere dopo, con calma. La priorità era avere
qualcosa di funzionante prima della scadenza di fine mese.

---

## Se qualcosa non funziona

Torna in chat e dimmi esattamente dove ti sei bloccato (es. "sono al punto 4,
Vercel mi dà questo errore: ...") — ti aiuto a risolvere.
