// Plug your algorithm here. Two options are supported:
// 1) Define a global function:    window.solve = async function(initialState) { ... return moves }
// 2) Or export a namespace object: window.UserSolver = { solve: async (initialState) => moves }
//
// initialState = {
//   cols, rows,
//   goal: { x, y, w: 2, h: 2 },
//   pieces: [ { id, type: '1x1'|'2x2'|'1x2'|'2x1', x, y, w, h }, ... ]
// }
//
// Return an array of moves. Each move = { id, dir: 'up'|'down'|'left'|'right', count?: number }

(function(){
  // Example: a trivial demo solver that makes no moves
  window.solve = async function(initialState) {
    // Replace with your real algorithm
    return [
      { id: 'B', dir: 'right' },
      { id: 'G', dir: 'up' },
      { id: 'G', dir: 'left' },
      { id: 'I', dir: 'up', count: 2 },
      { id: 'E', dir: 'right' }
    ];
  };
})();
