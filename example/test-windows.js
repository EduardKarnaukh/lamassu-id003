const Id003 = require('../lib/id003.js');

const connection = Id003.factory({
    rs232: {
        device: 'COM8',
        baudRate: 9600,
    },
});

connection.run((error) => {
    if(error)
        return;

    connection.rs232.serial.on('data', data => {
        console.log('messages', data);
    });

    // accept banknotes
    connection.enable();

    connection.on('billRead', data => {
        console.log('billRead', data);
        // stack banknote
        connection.stack();
    });

    connection.on('billValid', () => console.log('billValid'));
    connection.on('billRejected', () => console.log('billRejected'));
    connection.on('billRefused', () => console.log('billRefused'));
    connection.on('standby', (data) => console.log('standby', data));
    connection.on('stackerOpen', () => console.log('stackerOpen'));
    connection.on('acceptorJam', (err) => console.log('acceptorJam'));
    connection.on('stackerJam', (err) => console.log('stackerJam'));
});