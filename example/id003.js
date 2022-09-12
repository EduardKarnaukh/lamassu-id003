/*
setTimeout(runMock, 200);

function runMock() {
  id003.enable();
  setTimeout(function() { id003._simulate('accepting'); }, 100);
  setTimeout(function() { id003._simulate('escrow', 50); }, 200);
  setTimeout(function() { id003._simulate('powerDown'); }, 240);  
  setTimeout(function() { id003._simulate('powerUpStacker'); }, 400);  
}
*/

/* 

test powerUpStacker

function runMock() {
  id003.enable();
  setTimeout(function() { id003._simulate('accepting'); }, 100);
  setTimeout(function() { id003._simulate('escrow', 50); }, 200);
  setTimeout(function() { id003._simulate('powerDown'); }, 240);  
  setTimeout(function() { id003._simulate('powerUpStacker'); }, 400);  
}

test powerUpAcceptor
function runMock() {
  id003.enable();
  setTimeout(function() { id003._simulate('accepting'); }, 100);
  setTimeout(function() { id003._simulate('powerDown'); }, 120);  
  setTimeout(function() { id003._simulate('powerUpAcceptor'); }, 200);  
}


test 3

function runMock() {
  id003.enable();
  setTimeout(function() { id003._simulate('accepting'); }, 100);
  setTimeout(function() { id003._simulate('rejecting', 12); }, 200);
  setTimeout(function() { id003._simulate('enable'); }, 400);
  setTimeout(function() { id003.disable(); }, 450);
  setTimeout(function() { id003.enable(); }, 490);
  setTimeout(function() { id003._simulate('accepting'); }, 550);
  setTimeout(function() { id003._simulate('escrow', 5); }, 600);  
  setTimeout(function() { id003._simulate('stackerFull'); }, 660);  
  setTimeout(function() { id003._simulate('initialize'); }, 680);  
}


test 2

function runMock() {
  id003.enable();
  setTimeout(function() { id003._simulate('accepting'); }, 100);
  setTimeout(function() { id003._simulate('rejecting', 12); }, 200);
  setTimeout(function() { id003._simulate('enable'); }, 400);
  setTimeout(function() { id003._simulate('accepting'); }, 500);
  setTimeout(function() { id003._simulate('escrow', 5); }, 600);
  setTimeout(function() { id003._simulate('rejecting', 18); }, 620);
}

test 1
function runMock() {
  id003.enable();
  setTimeout(function() { id003._simulate('accepting'); }, 100);
  setTimeout(function() { id003._simulate('escrow', 100); }, 200);
  setTimeout(function() { id003._simulate('accepting'); }, 400);
  setTimeout(function() { id003._simulate('escrow', 5); }, 500);
  setTimeout(function() { id003.disable(); }, 600);
  setTimeout(function() { id003.enable(); }, 700);
}

*/