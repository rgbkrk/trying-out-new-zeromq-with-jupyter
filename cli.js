const { decode, encode } = require("./index");
const uuidv4 = require("uuid/v4");
const path = require("path");
const fs = require("fs");

const rxjs = require("rxjs");

const zmq = require("zeromq");

const readline = require("readline");

const { Session } = require("./session");

async function main() {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  if (process.platform !== "darwin") {
    throw new Error("This CLI only supports Mac for now");
  }

  const homedir = require("os").homedir();
  const [connectionFile] = process.argv.slice(2);

  if (!connectionFile || connectionFile.length <= 0) {
    throw new Error("we need a connection file");
  }

  const connectionFilePath = path.join(
    homedir,
    "Library",
    "Jupyter",
    "runtime",
    connectionFile
  );

  const connectionInfo = JSON.parse(
    await fs.promises.readFile(connectionFilePath)
  );

  const session = new Session(connectionInfo);

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
      case "k":
        reply = await session.send("kernel_info_request");
        break;
      case "e":
        session.send("execute_request", {
          code: `x = ${Math.random()}
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

  const obs2 = rxjs.Observable.create(async observer => {
    const reply = await session.send("kernel_info_request");
    observer.next(reply);
    observer.complete();
  });

  obs2.subscribe(x => console.log("RESPONSE", x));

  const obs = rxjs.Observable.create(async observer => {
    for await (const message of session.iopub()) {
      observer.next(message);
    }
    observer.complete();
  });

  obs.subscribe(x => console.log("observed: ", x));
}

main().catch(err => console.error(err));
