# Klotski Solver

An interactive, web-based Klotski puzzle solver with a beautiful UI and replacable solving algorithm.

[Try it here](https://tomfrost.github.io/KlotskiSolver/) or [Test with a pre-built puzzle](https://tomfrost.github.io/KlotskiSolver/#eyJjb2xzIjo0LCJyb3dzIjo1LCJnb2FsIjp7IngiOjEsInkiOjMsInciOjIsImgiOjJ9LCJwaWVjZXMiOlt7InR5cGUiOiIyeDIiLCJ4IjoxLCJ5IjowLCJ3IjoyLCJoIjoyLCJpZCI6IkEifSx7InR5cGUiOiIyeDEiLCJ4IjoxLCJ5IjoyLCJ3IjoyLCJoIjoxLCJpZCI6IkIifSx7InR5cGUiOiIxeDIiLCJ4IjowLCJ5IjowLCJ3IjoxLCJoIjoyLCJpZCI6IkMifSx7InR5cGUiOiIxeDIiLCJ4IjozLCJ5IjowLCJ3IjoxLCJoIjoyLCJpZCI6IkQifSx7InR5cGUiOiIxeDIiLCJ4IjowLCJ5IjozLCJ3IjoxLCJoIjoyLCJpZCI6IkUifSx7InR5cGUiOiIxeDIiLCJ4IjozLCJ5IjozLCJ3IjoxLCJoIjoyLCJpZCI6IkYifSx7InR5cGUiOiIxeDEiLCJ4IjoxLCJ5IjozLCJ3IjoxLCJoIjoxLCJpZCI6IkcifSx7InR5cGUiOiIxeDEiLCJ4IjoyLCJ5IjozLCJ3IjoxLCJoIjoxLCJpZCI6IkgifSx7InR5cGUiOiIxeDEiLCJ4IjoxLCJ5Ijo0LCJ3IjoxLCJoIjoxLCJpZCI6IkkifSx7InR5cGUiOiIxeDEiLCJ4IjoyLCJ5Ijo0LCJ3IjoxLCJoIjoxLCJpZCI6IkoifV19)

## 🎯 What is Klotski?

Klotski is a classic sliding block puzzle where the goal is to move a large 2×2 block to a designated exit position by sliding other pieces around the board. The challenge lies in the limited space and the fact that pieces can only slide—they cannot be lifted or rotated.

## ✨ Features

- **Interactive Visual Editor**: Drag and drop pieces to create custom puzzles
- **Built-in Solver**: Includes a breadth-first search algorithm with Zobrist hashing for efficient solving -- but maybe you can do better!
- **Customizable Algorithms**: Replace the built-in solver with your own implementation
- **Animation System**: Watch solutions play back step-by-step with adjustable speed
- **Puzzle Management**: Save, load, and share puzzles with others
- **Responsive Design**: Works on desktop and mobile devices
- **Multiple Piece Types**: Support for 1×1, 1×2, 2×1, and 2×2 pieces

## 🚀 Development Quick Start

1. Clone this repository:
   ```bash
   git clone https://github.com/TomFrost/KlotskiSolver.git
   cd KlotskiSolver
   ```

2. Open `index.html` in your browser. It's that easy!

3. When you make a change, just refresh.

## 🎮 How to Use

### Creating Puzzles
1. **Add Pieces**: Drag pieces from the palette on the left onto the board
2. **Move Pieces**: Click and drag pieces on the board to position them
3. **Delete Pieces**: Drag pieces off the board or select and click "Delete Selected"
4. **Goal**: The highlighted square shows where the 2×2 piece needs to reach

### Solving Puzzles
1. **Solve**: Click the blue Play button (▶) to run the solving algorithm
2. **Watch**: The solution will animate automatically
3. **Controls**: Use playback controls to step through the solution manually
4. **Reset**: Click "Reset" to return to the puzzle's starting state

### Managing Puzzles
- **Save**: Click "Save" to store your puzzle locally
- **Load**: Select from saved puzzles and click "Load"
- **Share**: Click "Share" to get a link you can send to others
- **Export/Import**: Download puzzles as JSON files or import them

## 🧠 Customizing the Solving Algorithm

The real fun begins when you implement your own solving algorithm! The project is designed as a coding challenge where you can experiment with different approaches. The current algorithm is heavily documented because I wrote it while teaching algorithm design to a 13-year-old!

### Quick Start: Replace the Algorithm

1. Open `user-solver.js` in your favorite editor
2. Replace the existing algorithm with your own implementation -- there are docs in there that show what you're given, and what you're expected to return, or just keep reading
3. Refresh the page and test your solver

### API Reference

Your solving function should follow this format:

```javascript
// Option 1: Global function
window.solve = async function(initialState) {
  // Your algorithm here
  return moves; // Array of move objects
}

// Option 2: Namespace object
window.UserSolver = {
  solve: async function(initialState) {
    // Your algorithm here
    return moves; // Array of move objects
  }
}
```

### Input Format (`initialState`)

```javascript
{
  cols: 4,        // Board width
  rows: 5,        // Board height
  goal: {         // Target position for 2×2 piece
    x: 1, y: 3,
    w: 2, h: 2
  },
  pieces: [       // Array of all pieces
    {
      id: "piece_1",
      type: "2x2",  // "1x1", "1x2", "2x1", or "2x2"
      x: 1, y: 0,   // Position
      w: 2, h: 2    // Dimensions
    },
    // ... more pieces
  ]
}
```

### Output Format (`moves`)

Return an array of move objects:

```javascript
[
  {
    id: "piece_1",
    dir: "down",     // "up", "down", "left", "right"
    count: 2         // Optional: number of steps (default: 1)
  },
  // ... more moves
]
```

### Return `null` if no solution exists.

### Algorithm Ideas to Try

- **Breadth-First Search** (included): Guarantees shortest solution
- **A* Search**: Use heuristics to find solutions faster
- **Depth-First Search**: Simple but may find longer solutions
- **Bidirectional Search**: Search from both start and goal
- **Monte Carlo Tree Search**: Use random playouts
- **Machine Learning**: Train a neural network!

### Tips for Implementation

1. **State Representation**: How you represent board states affects performance
2. **Duplicate Detection**: Use hashing to avoid revisiting states
3. **Move Generation**: Efficiently generate all possible moves
4. **Pruning**: Eliminate obviously bad moves early
5. **Memory Management**: Large search trees can consume lots of memory

## 🛠 Built With

- **Vanilla JavaScript**: No frameworks, just clean, modern JS
- **HTML5 Canvas**: Smooth 2D rendering and animations
- **CSS3**: Responsive design with modern UI patterns
- **Local Storage**: Persistent puzzle saving
- **Web APIs**: Clipboard, File, and Animation APIs

## 📁 Project Structure

```
klotski-solver/
├── index.html          # Main application page
├── styles.css          # All styling and responsive design
├── main.js             # Application logic and UI handling
├── board.js            # Board model and game state management
├── render.js           # Canvas rendering and visual effects
├── animate.js          # Animation system for solution playback
├── storage.js          # Local storage and puzzle management
├── utils.js            # Utility functions and helpers
├── user-solver.js      # 🎯 YOUR ALGORITHM GOES HERE
└── README.md           # This file
```

## 🤝 Contributing

Contributions are welcome. Improve the solving algorithm that's included? Make the mobile experience better? Just pop open a PR and share!

This project is significantly lighter than my other projects -- no compile step, no code style or linting tools, no tests. The idea behind this project is getting up and running with no dependencies and no necessity to learn anything other than the logic that makes solving a puzzle work. With that goal in mind, PRs that add these modern amenities/complexities will be gracefully rejected. This is here for budding young minds, not the enterprise ;-).

## 📜 License

This project is licensed under the MIT License - see LICENSE.txt.

## 🧍‍♂️ About & Credits

This Klotski Solver was created by me, Tom Shawver, in 2025 to teach algorithm design and web development to my kids. They have a physical, tangible Klotski set, and this was a great foray into reasoning about an automated solution. I wanted them to be able to see what their solutions are doing in a visual way, and this project was born.
