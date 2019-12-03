const { decode, encode } = require("./index");
const uuidv4 = require("uuid/v4");

const zmq = require("zeromq");

class Session {
  constructor(connectionInfo) {
    this.connectionInfo = connectionInfo;

    this.sessionID = uuidv4();

    this.iopub_sock = new zmq.Subscriber();
    this.iopub_sock.connect(
      `${connectionInfo.transport}://${connectionInfo.ip}:${connectionInfo.iopub_port}`
    );
    this.iopub_sock.subscribe("");

    this.shell_sock = new zmq.Dealer();
    this.shell_sock.connect(
      `${connectionInfo.transport}://${connectionInfo.ip}:${connectionInfo.shell_port}`
    );
  }

  async send(msg_type, content = {}) {
    const message = {
      header: {
        msg_id: uuidv4(),
        username: "nteract",
        session: this.sessionID,
        date: new Date().toISOString(),
        version: "5.0",
        msg_type
      },
      content
    };

    await this.shell_sock.send(
      encode(
        message,
        this.connectionInfo.signature_scheme,
        this.connectionInfo.key
      )
    );

    const rawFrames = await this.shell_sock.receive();

    const reply = decode(
      rawFrames,
      this.connectionInfo.signature_scheme,
      this.connectionInfo.key
    );

    return reply;
  }

  async *iopub() {
    for await (const [topic, ...frames] of this.iopub_sock) {
      const message = decode(
        frames,
        this.connectionInfo.signature_scheme,
        this.connectionInfo.key
      );
      yield message;
    }
  }

  close() {
    this.iopub_sock.close();
    this.shell_sock.close();
  }
}

module.exports = {
  Session
};
