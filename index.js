const { wireProtocol } = require("@nteract/messaging");

module.exports = {
  decode: wireProtocol.decode,
  encode: wireProtocol.encode
};
