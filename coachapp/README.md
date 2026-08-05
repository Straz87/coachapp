# Coach App

App web per seguire i tuoi clienti da remoto: calendario allenamenti, piano
alimentare, tracciamento progressi, chat. Costruita con Next.js e Supabase.

Per la guida completa di setup e pubblicazione, leggi **SETUP.md**.

## Struttura del progetto

```
src/
  app/
    login/                   pagina di accesso
    trainer/                 area coach (protetta, ruolo "trainer")
      page.tsx               lista clienti
      nuovo-cliente/         creazione nuovo cliente
      clienti/[id]/          scheda cliente (abbonamento, progressi)
        dieta/                piano alimentare del cliente
      calendario/             calendario allenamenti (crea/assegna schede)
      chat/                   messaggistica con i clienti
    cliente/                  area cliente (protetta, ruolo "client")
      page.tsx                allenamenti della settimana
      progressi/              registrazione peso/foto/note
      dieta/                  piano alimentare assegnato
      chat/                   messaggi col trainer
    api/clients/              endpoint per creare un nuovo cliente (server-side)
  components/                 componenti riutilizzabili
  lib/
    supabase/                 client Supabase (browser, server, admin)
    auth.ts                   helper per proteggere le pagine per ruolo
    dates.ts                  utilità per il calendario settimanale
supabase/
  schema.sql                  schema database + sicurezza (Row Level Security)
```

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Supabase**: database Postgres, autenticazione, storage foto, chat realtime
- **Vercel**: hosting (gratuito per questo utilizzo)
