const Id003 = require('../lib/id003.js');

const connection = Id003.factory({
  rs232: {
    device: '/dev/ttyS0',
    baudRate: 9600,
  },
});

connection.run(() => {
  connection.on('billRead', data => {
    console.log('billRead', data);
    connection.stack();
    // connection.stack();
  });
  connection.on('dispatch', data => console.log('dispatch', data));

  connection.on('billValid', () => console.log('billValid'));
  connection.on('billRejected', () => console.log('billRejected'));
  connection.on('billRefused', () => console.log('billRefused'));
  connection.on('standby', () => {
    console.log(connection.getVersion());
    connection.enable();
  });
  connection.on('stackerOpen', () => console.log('stackerOpen'));
  connection.on('error', err => console.log('error', err));
  connection.on('acceptorJam', (err) => console.log('acceptorJam'));
  connection.on('stackerJam', (err) => console.log('stackerJam'));
});
