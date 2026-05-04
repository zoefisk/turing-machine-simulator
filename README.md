# Turing Machine Simulator for Binary Addition
 
## Getting Started

Install the dependencies:

```bash
npm install
```

Next, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Live Deployment
If you'd prefer to visit the site live, go to [turingmachinesimulator.zoefisk.com](http://www.turingmachinesimulator.zoefisk.com). The site may not be available on WPI wifi, unfortunately. In that case, use the localhost method.

### GitHub repository
You can view the GitHub repository at [https://github.com/zoefisk/turing-machine-simulator](https://github.com/zoefisk/turing-machine-simulator). 

## High-level Explanation

The actual Turing machine logic is implemented in `lib/turing/binaryAdditionMachine.ts`. The program includes a "snapshot" that represents the current state of the Turing machine, with all of the relevant information needed for rendering on the frontend site. This is used both by the Tape component, as well as the state diagram. 

### Program Setup

The following code represents all of the states that the Turing machine can be in during the addition process. It starts in the `SEEK_LEFT` state, and transitions through the various states as it processes the input bits and computes the results.

```ts
export type BinaryAdditionState =
  | "SEEK_LEFT"                 
  | "SEEK_RIGHT"               
  | "SEEK_RESULT"          
  | "SEEK_RIGHT_MARK"           
  | "SEEK_LEFT_MARK"           
  | "SEEK_FINAL_RESULT"         
  | "HALT";                   
```

Next, is the Turing machine's snapshot. It includes the `BinaryAdditionState` state, the current contents of the tape (e.g. "1011c10", the "c" being the spacer between the two strings), the current number being pointed at, the current carry value, various column rules, a human-readable message explaining the current step, the type of transition, the cell that should be highlighted on the UI, the previous transition, and the index where the result zone begins on the tape. The snapshot can be accessed via the function `snapshot`.

```ts
export type BinaryAdditionSnapshot = {
  state: BinaryAdditionState;           
  tape: string[];                   
  head: number;                     
  carry: 0 | 1;                     
  columnRule?: {
    carryIn: 0 | 1;                 
    carryOut: 0 | 1;             
    leftBit: 0 | 1;              
    resultBit: 0 | 1;              
    rightBit: 0 | 1;               
  };
  message: string;                 
  transitionKind: "compute"        
                | "halt"
                | "mark"
                | "move"
                | "restore"
                | "write";
  highlightedIndex?: number;       
  lastTransition?: string;          
  resultStart: number;            
};
```

### Main Functions

The machine takes an input of the form:

```text
leftOperand c rightOperand
```

For example, adding `1011` and `110` begins with:

```text
1011c110
```

The final result will be listed at the end, separated by a `|`.

The main code is within the function `createBinaryAdditionMachine`, which intakes that input string. The function concatenates the input and sets up variables for UI rendering. It then defines helper functions, including `markLeftBit`, `markRightBit`, `restoreMarker`, `hasRemainingBits`, `moveHeadToward`, `computeStagedResult`, and `currentColumnRule`. 

Next, a significant amount of the computation is handled in the `step` function, which goes through every `BinaryAdditionState`, respectively. 

### General strategy

The machine performs binary addition from right to left, just as ordinary column addition does.

For each column:

1. It finds the next unprocessed bit in the left operand and temporarily marks it with `x`.
2. It finds the matching bit in the right operand and temporarily marks it with `y`.
3. It combines those two bits with the current carry.
4. It writes the result bit into the result zone on the right side of the tape.
5. It restores the marked input symbols back to `0` or `1`.
6. It shifts attention one column to the left and repeats.

If one number runs out of bits before the other, the machine treats the missing bit as an implied `0`.

When both inputs are exhausted:

- if the carry is `0`, the machine halts
- if the carry is `1`, the machine writes a final `1` in the result zone and then halts
