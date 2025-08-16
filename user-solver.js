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
  // For sanity purposes, all coordinates will be in y,x format. This means that
  // printing the board as a two-dimension array with console.log will show the
  // board in the correct orientation.
  //
  // To be clear, this means:
  // board[rows][cols], where y indicates the row number and x indicates the column number.
  const PIECE_TYPES = {
    '1x1': 0,
    '2x2': 1,
    '1x2': 2,
    '2x1': 3,
  }

  const DIRECTIONS = {
    UP: 0,
    DOWN: 1,
    LEFT: 2,
    RIGHT: 3,
  }

  const DIRECTION_MAP = [
    'up',
    'down',
    'left',
    'right',
  ]

  // [y, x]
  const DIRECTION_VECTORS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]

  function buildZobristMatrix(cols, rows, pieceTypes) {
    // Create a 3-dimensional array of random 32-bit non-zero numbers
    const matrix = new Array(rows).fill(0).map(() =>
      new Array(cols).fill(0).map(() =>
        new Array(pieceTypes).fill(0).map(() => {
          let value = 0;
          do {
            value = Math.floor(Math.random() * 0xffffffff);
          } while (!value);
          return value;
        })
      )
    );
    return matrix;
  }

  // Mirror is used to hash the board in the HORIZONTAL mirror direction (x).
  // Vertical (y) remains the same in this case.
  function hashBoard(board, zobMatrix, mirror = false) {
    let hash = 0;
    for (let y = 0; y < board.length; y++) {
      for (let x = 0; x < board[0].length; x++) {
        const realX = mirror ? board[0].length - x - 1 : x;
        if (board[y][x] !== null) {
          hash ^= zobMatrix[y][realX][board[y][x]];
        }
      }
    }
    return hash;
  }

  function makeBoard(cols, rows, pieces) {
    const board = new Array(rows).fill(null).map(() => new Array(cols).fill(null));
    pieces.forEach(piece => {
      for (let y = piece.y; y < piece.y + piece.h; y++) {
        for (let x = piece.x; x < piece.x + piece.w; x++) {
          board[y][x] = PIECE_TYPES[piece.type];
        }
      }
    });
    return board;
  }

  function isGoalState(pieces, goal) {
    // The 2x2 piece is the only piece that can be placed in the goal state
    return pieces.some(piece => piece.type === '2x2' && piece.x === goal.x && piece.y === goal.y);
  }

  function isOutOfBounds(board, piece, moveVector) {
    return piece.y + moveVector[0] < 0 ||
      piece.y + moveVector[0] + piece.h > board.length ||
      piece.x + moveVector[1] < 0 ||
      piece.x + moveVector[1] + piece.w > board[0].length;
  }

  function isBlocked(board, piece, moveVector) {
    // The binary matrix of the board includes the area of the piece we're trying
    // to move, so only check the cells in the direction of the move for blockage.
    if (moveVector[0] === 1) {
      for (let x = piece.x; x < piece.x + piece.w; x++) {
        if (board[piece.y + piece.h][x] !== null) return true;
      }
    } else if (moveVector[0] === -1) {
      for (let x = piece.x; x < piece.x + piece.w; x++) {
        if (board[piece.y - 1][x] !== null) return true;
      }
    } else if (moveVector[1] === 1) {
      for (let y = piece.y; y < piece.y + piece.h; y++) {
        if (board[y][piece.x + piece.w] !== null) return true;
      }
    } else if (moveVector[1] === -1) {
      for (let y = piece.y; y < piece.y + piece.h; y++) {
        if (board[y][piece.x - 1] !== null) return true;
      }
    }
    return false;
  }

  function updateHash(zobMatrix, hash, oldPiece, newPiece, mirror = false) {
    [oldPiece, newPiece].forEach(piece => {
      for (let y = piece.y; y < piece.y + piece.h; y++) {
        for (let x = piece.x; x < piece.x + piece.w; x++) {
          const realX = mirror ? zobMatrix[0].length - x - 1 : x;
          hash ^= zobMatrix[y][realX][PIECE_TYPES[piece.type]];
        }
      }
    });
    return hash;
  }

  function updateBoard(board, piece, newPiece) {
    // Clone the board so we don't mutate the original
    const newBoard = board.map(row => row.slice());
    // Remove the old piece from the board
    for (let y = piece.y; y < piece.y + piece.h; y++) {
      for (let x = piece.x; x < piece.x + piece.w; x++) {
        newBoard[y][x] = null;
      }
    }
    // Add the new piece to the board
    for (let y = newPiece.y; y < newPiece.y + newPiece.h; y++) {
      for (let x = newPiece.x; x < newPiece.x + newPiece.w; x++) {
        newBoard[y][x] = PIECE_TYPES[newPiece.type];
      }
    }
    return newBoard;
  }

  function createStateFromMove(game, currentState, pieceId, dir) {
    const { zobMatrix } = game;
    const moveVector = DIRECTION_VECTORS[dir];
    const newState = {
      ...currentState,
      parentState: currentState,
      lastMove: { id: pieceId, dir }
    };
    newState.pieces = currentState.pieces.map(piece => {
      if (piece.id === pieceId) {
        const newPiece = { ...piece };
        newPiece.y += moveVector[0];
        newPiece.x += moveVector[1];
        newState.hash = updateHash(zobMatrix, currentState.hash, piece, newPiece);
        newState.mirrorHash = updateHash(zobMatrix,currentState.mirrorHash, piece, newPiece, true);
        newState.board = updateBoard(currentState.board, piece, newPiece);
        return newPiece;
      }
      return piece;
    });
    return newState;
  }

  function enqueueLegalMoves(game, currentState) {
    const { stateQueue } = game;
    // Try all possible moves, starting from the last piece moved
    // so that any "continuation" moves are tried first.
    const lastMovedIdx = currentState.lastMove ? currentState.pieces.findIndex(
      piece => piece.id === currentState.lastMove?.id
    ) : 0;
    for (let i = 0; i < currentState.pieces.length; i++) {
      const piece = currentState.pieces[(lastMovedIdx + i) % currentState.pieces.length];
      for (let dir = 0; dir < 4; dir++) {
        const moveVector = DIRECTION_VECTORS[dir];
        // Bail if the move is out of bounds
        if (isOutOfBounds(currentState.board, piece, moveVector)) continue;
        // Bail if the move is blocked
        if (isBlocked(currentState.board, piece, moveVector)) continue;
        // Create the new state for this move
        const newState = createStateFromMove(game, currentState, piece.id, dir);
        // Add the new state to the state queue
        stateQueue.push(newState);
      }
    }
  }

  function solveGame(game) {
    const { attemptedPositions, goal, stateQueue } = game;
    while (stateQueue.length) {
      const currentState = stateQueue.shift();
      // Bail if the current state has already been tried
      if (attemptedPositions.has(currentState.hash) ||
        attemptedPositions.has(currentState.mirrorHash)) continue;
      // Check if the current state is the goal state
      if (isGoalState(currentState.pieces, goal)) {
        return currentState;
      }
      // Add the hashes to the attemptedPositions
      attemptedPositions.add(currentState.hash);
      attemptedPositions.add(currentState.mirrorHash);
      // Add all possible moves to the state queue
      enqueueLegalMoves(game, currentState);
    }
    // There was no valid solution
    return null;
  }

  window.solve = function(initialState) {
    const zobMatrix = buildZobristMatrix(initialState.cols, initialState.rows, 4);
    const board = makeBoard(initialState.cols, initialState.rows, initialState.pieces);
    console.log(board);
    const game = {
      zobMatrix,
      attemptedPositions: new Set(),
      goal: initialState.goal,
      stateQueue: [{
        board,
        pieces: initialState.pieces,
        lastMove: null, // { id, dir: 0-3 }
        hash: hashBoard(board, zobMatrix),
        mirrorHash: hashBoard(board, zobMatrix, true),
        parentState: null
      }]
    }

    const solvedState = solveGame(game);
    if (!solvedState) return null;
    const moves = [];
    let currentState = solvedState;
    while (currentState.parentState) {
      const move = {
        id: currentState.lastMove.id,
        dir: DIRECTION_MAP[currentState.lastMove.dir]
      }
      // If the move is a continuation, add the count
      if (moves.length &&
          moves[moves.length - 1].id === move.id &&
          moves[moves.length - 1].dir === move.dir) {
        moves[moves.length - 1].count = moves[moves.length - 1].count ?
          moves[moves.length - 1].count + 1 :
          2;
      } else {
        moves.push(move);
      }
      currentState = currentState.parentState;
    }
    return moves.reverse();
  };
})();
