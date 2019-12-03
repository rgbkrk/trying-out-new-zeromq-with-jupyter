# Tinkering with ZeroMQ.js v6

We are _finally_ evolving the ZeroMQ API. It now has support for async await on router/dealer sockets and async iterable support for subscriber sockets. This seemed like a good chance to see how we can write some modern libraries for interfacing with jupyter kernels.

## Development

```
git clone https://github.com/rgbkrk/trying-out-new-zeromq-with-jupyter
cd trying-out-new-zeromq-with-jupyter
yarn
```

## Playing with the hokey CLI

In order to work with this you'll need to run:

```
jupyter console
```

in one terminal then run `%connect_info` in the resulting jupyter session. It should have output like this:

```
In [1]: %connect_info
{
  "shell_port": 57728,
  "iopub_port": 57729,
  "stdin_port": 57730,
  "control_port": 57731,
  "hb_port": 57732,
  "ip": "127.0.0.1",
  "key": "7ee2744e-57c594d3f0cfd7e52e38d161",
  "transport": "tcp",
  "signature_scheme": "hmac-sha256",
  "kernel_name": ""
}

Paste the above JSON into a file, and connect with:
    $> jupyter <app> --existing <file>
or, if you are local, you can connect with just:
    $> jupyter <app> --existing kernel-11876.json
or even just:
    $> jupyter <app> --existing
if this is the most recent Jupyter kernel you have started.
```

Then in another terminal run the CLI with the kernel file name as an argument::

```
node cli.js kernel-11876.json
```



