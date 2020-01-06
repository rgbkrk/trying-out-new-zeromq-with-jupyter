import { readFileSync } from "fs";

import { Observable, Observer } from "rxjs";
import { mergeMap, map } from "rxjs/operators";

import * as pg from "pg";

import * as path from "path";

import { homedir } from "os";

import { Session } from "./session";
import { RawJupyterMessage } from "@nteract/messaging/lib/wire-protocol";
import { acquireSession } from "./connect";

const certsDir = path.join(homedir(), "cockroach-data", "certs");

var config = {
  user: "snippy",
  host: "localhost",
  database: "notes",
  port: 26257,
  ssl: {
    ca: readFileSync(path.join(certsDir, "ca.crt")).toString(),
    key: readFileSync(path.join(certsDir, "client.snippy.key")).toString(),
    cert: readFileSync(path.join(certsDir, "client.snippy.crt")).toString()
  }
};

function normalizeUUID(id: string): string {
  const portions = id.split("-");
  return portions.join("");
}

function memorializeJupyterSession(client: pg.PoolClient, session: Session) {
  const obs = Observable.create(
    async (observer: Observer<RawJupyterMessage>) => {
      for await (const message of session.iopub()) {
        observer.next(message);
      }
      observer.complete();
    }
  ) as Observable<RawJupyterMessage>;

  const subscription = obs
    .pipe(
      map((message: RawJupyterMessage) => {
        const header = Object.assign({}, message.header, {
          session: normalizeUUID(message.header.session),
          msg_id: normalizeUUID(message.header.msg_id)
        });

        const parent_header = Object.assign({}, message.parent_header, {
          session: normalizeUUID(message.parent_header.session),
          msg_id: normalizeUUID(message.parent_header.msg_id)
        });

        return Object.assign({}, message, { parent_header, header });
      }),
      mergeMap(message => {
        return client.query(
          "INSERT INTO raw_messages (id, messages) VALUES ($1, $2);",
          [message.header.msg_id, message]
        );
      })
    )
    .subscribe(
      message => {
        console.log("message processed");
      },
      err => {
        console.error("messaging error", err);
      },
      () => {
        console.log("kernel closed");
      }
    );

  return subscription;
}

// Clean finisher
// This is overriden later to do cleanup
let finish = (code?: number) => {
  console.log("nothing to clean up, cleanly exiting");
  process.exit(code);
};

async function main() {
  const pool = new pg.Pool(config);

  const client = await pool.connect();

  // Cleanup by closing the client and exiting
  finish = (code: number) => {
    client.release();
    console.log("⌗  CLEANED UP ⌗");
    process.exit();
  };

  console.log("⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗");
  console.log("⌗ INITIALIZED ⌗");
  console.log("⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗⌗");

  /**
   * CREATE TABLE programming (
    id UUID DEFAULT uuid_v4()::UUID PRIMARY KEY,
    posts JSONB
  );
   */
  let results;

  results = await client.query(`
  CREATE TABLE IF NOT EXISTS raw_messages (
      id UUID DEFAULT uuid_v4()::UUID PRIMARY KEY,
      messages JSON
  );`);

  // Connect to a random session
  const session = await acquireSession("--random");
  console.log("session", session);

  // This should be set up with callbacks...
  const subscription = memorializeJupyterSession(client, session);

  finish = (code: number) => {
    subscription.unsubscribe();
    session.close();
    client.release();
    console.log("⌗  CLEANED UP ⌗");
    process.exit();
  };

  process.on("SIGINT", async function() {
    console.log("Interrupted, dumping now");
    results = await client.query("SELECT id, messages FROM raw_messages;");
    console.log(results);

    finish();
  });
}

main()
  .then(() => console.log("all done 👋"))
  .catch(err => {
    console.error("UH OH 😬", err);
    finish(2);
  });
