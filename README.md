# lamassu-id003

A library that communicates with a bill validator via the **id003** protocol.

## Usage

See the test in **example\test-windows.js**. Test opens port **COM8**. If port is not opened, state machine is switched
to the state **comerror**. If the port is opened, device starts accept banknotes.