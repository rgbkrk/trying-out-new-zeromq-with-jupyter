const zmq = require("zeromq");

async function run() {
  const producerID = Math.ceil(Math.random() * 1000);
  const sock = new zmq.Push();

  await sock.bind("tcp://127.0.0.1:3000");
  console.log("Producer bound to port 3000");

  while (true) {
    const delta = Math.random() * 500;

    await sock.send(`some work from ${producerID} who waits ${delta}ms`);
    await new Promise(resolve => setTimeout(resolve, delta));
  }
}

run();
