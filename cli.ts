import * as path from "path";
import * as fs from "fs";

import { Observable } from "rxjs";

import * as readline from "readline";

import { acquireSession } from "./connect";

async function main() {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  let [connectionFile] = process.argv.slice(2);

  const session = await acquireSession(connectionFile);

  function close() {
    console.log("closing the session");
    session.close();
    process.exit();
  }

  process.on("SIGINT", close);

  process.stdin.on("keypress", async (str, key) => {
    if (key.ctrl && key.name === "c") {
      close();
    }

    let reply = null;

    switch (key.name) {
      case "c":
        reply = await session.sendOnControl("kernel_info_request");
        break;

      case "h":
        reply = await session.echo("HEARTBEAT");
        console.log(reply);
        return;
      case "b":
        reply = await session.sendOnControl("bad_message");
        break;
      case "k":
        reply = await session.send("kernel_info_request");
        break;
      case "s":
        reply = await session.send("status");
        break;
      case "e":
        session.send("execute_request", {
          code: `
from IPython.display import HTML          
x = ${Math.random()}
display(x)
display(HTML("<b>hi ${Math.ceil(Math.random() * 100)}</b>"))
          `,
          silent: false,
          store_history: false,
          user_expressions: {}
        });
        break;
      case "q":
        close();
        return;
      default:
        console.log("we don't support ", key.name);
        return;
    }

    console.log(reply);
  });

  const obs2 = Observable.create(async observer => {
    const reply = await session.send("kernel_info_request");
    observer.next(reply);
    observer.complete();
  });

  obs2.subscribe(x => console.log("RESPONSE", x));

  const obs = Observable.create(async observer => {
    for await (const message of session.iopub()) {
      observer.next(message);
    }
    observer.complete();
  });

  obs.subscribe(x => console.log("observed: ", x));
}

main().catch(err => console.error(err));
