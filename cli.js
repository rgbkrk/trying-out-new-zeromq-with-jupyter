const { decode, encode } = require("./index");
const uuidv4 = require("uuid/v4");
const path = require("path");
const fs = require("fs");

const rxjs = require("rxjs");

const zmq = require("zeromq");

const readline = require("readline");

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

  const sessionID = uuidv4();

  const iopub_sock = new zmq.Subscriber();

  iopub_sock.connect(
    `${connectionInfo.transport}://${connectionInfo.ip}:${connectionInfo.iopub_port}`
  );
  iopub_sock.subscribe("");

  const shell_sock = new zmq.Dealer();

  shell_sock.connect(
    `${connectionInfo.transport}://${connectionInfo.ip}:${connectionInfo.shell_port}`
  );

  process.on("SIGINT", () => {
    console.log("closing the socket");
    iopub_sock.close();
    shell_sock.close();
    process.exit();
  });

  process.stdin.on("keypress", async (str, key) => {
    if (key.ctrl && key.name === "c") {
      process.exit();
    }

    const message = {
      header: {
        msg_id: uuidv4(),
        username: "nteract",
        session: sessionID,
        date: new Date().toISOString(),
        msg_type: "kernel_info_request",
        version: "5.0"
      },
      content: {}
    };

    switch (key.name) {
      case "k":
        message.header.msg_type = "kernel_info_request";
        message.content = {};
        break;
      case "e":
        message.header.msg_type = "execute_request";
        message.content = {
          code: `x = ${Math.random()}
display(x)
display(HTML("<b>hi ${Math.ceil(Math.random() * 100)}</b>"))
          `,
          silent: false,
          store_history: false,
          user_expressions: {}
        };
        break;
      default:
        console.log("we don't support ", key.name);
        return;
    }

    await shell_sock.send(
      encode(message, connectionInfo.signature_scheme, connectionInfo.key)
    );

    const rawFrames = await shell_sock.receive();

    const reply = decode(
      rawFrames,
      connectionInfo.signature_scheme,
      connectionInfo.key
    );
    console.log(reply);
  });

  const obs = rxjs.Observable.create(async observer => {
    for await (const [topic, ...frames] of iopub_sock) {
      const message = decode(
        frames,
        connectionInfo.signature_scheme,
        connectionInfo.key
      );
      observer.next(message);
    }
    observer.complete();
  });

  obs.subscribe(x => console.log("observed: ", x));
}

main();
