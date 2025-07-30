# ADR-002: FHIRSchema Converter Algorithm Selection

## Status
Proposed

## Context

We need to implement a TypeScript converter that transforms FHIR StructureDefinitions into FHIRSchema format. The existing Clojure implementation uses a stack-based algorithm with path analysis and action calculation. We need to evaluate this approach and consider alternatives for our TypeScript implementation.

## Current Clojure Algorithm Analysis

### Overview
The Clojure implementation uses a sophisticated stack-based approach:

1. **Path Processing**: Parses element paths into structured components with metadata
2. **Action Calculation**: Compares paths to generate enter/exit actions
3. **Stack-Based Building**: Maintains a value stack to build nested structures
4. **Special Handling**: Choice types, slicing, extensions, and element references

### Strengths
- **Efficient Path Navigation**: Minimizes traversal by calculating exact actions needed
- **Clean Separation**: Path analysis, action calculation, and structure building are separate concerns
- **Handles Complex Cases**: Slicing, choice types, and circular references work well
- **Immutable Operations**: Functional approach with immutable data structures

### Weaknesses
- **Complexity**: The algorithm is complex and requires understanding multiple concepts
- **Debugging Difficulty**: Stack-based approach with actions can be hard to debug
- **Path Enrichment Logic**: Complex logic for inheriting slice context
- **Action Calculation**: The enter/exit calculation is intricate and error-prone

## Alternative Approaches

### Option 1: Direct Recursive Building
**Description**: Build the schema recursively by grouping elements by their parent path.

**Pros**:
- Simpler to understand and implement
- Direct parent-child relationships
- Easier debugging with clear call stack

**Cons**:
- Multiple passes over elements
- Complex slice handling
- Memory overhead for intermediate structures

**Implementation sketch**:
```
1. Group elements by parent path
2. Build root elements
3. Recursively attach children
4. Handle slices as special case
```

### Option 2: AST-Based Transformation
**Description**: Parse StructureDefinition into an AST, then transform to FHIRSchema.

**Pros**:
- Clear intermediate representation
- Easier to validate and transform
- Supports multiple output formats
- Better for complex transformations

**Cons**:
- Additional complexity layer
- More memory usage
- Two-phase process

**Implementation sketch**:
```
1. Parse differential into AST nodes
2. Resolve references and types
3. Transform AST to FHIRSchema
4. Optimize and validate output
```

### Option 3: Visitor Pattern with State
**Description**: Use visitor pattern to traverse elements with accumulated state.

**Pros**:
- Extensible for new element types
- Clear separation of concerns
- Easy to add new behaviors
- Good for incremental processing

**Cons**:
- More boilerplate code
- State management complexity
- Potential performance overhead

**Implementation sketch**:
```
1. Create visitors for each element type
2. Maintain conversion state
3. Visit elements in order
4. Build schema incrementally
```

### Option 4: Streaming/Pipeline Approach
**Description**: Process elements as a stream with transformation pipeline.

**Pros**:
- Memory efficient
- Composable transformations
- Good for large structures
- Functional programming style

**Cons**:
- Complex for nested structures
- Difficult slice handling
- State management challenges

**Implementation sketch**:
```
1. Stream elements through pipeline
2. Transform, group, and nest
3. Handle special cases in stages
4. Collect into final schema
```

### Option 5: Hybrid Stack-Based (Improved Clojure)
**Description**: Refine the Clojure approach with improvements for TypeScript.

**Pros**:
- Proven algorithm that works
- Handles all edge cases
- Single pass efficiency
- Can leverage existing test cases

**Cons**:
- Still complex
- Requires careful implementation

**Improvements over original**:
- Simplified action types (combine enter/enter-slice)
- Better type safety with TypeScript
- Clearer path structure
- Improved debugging support

## Decision

We recommend **Option 5: Hybrid Stack-Based (Improved Clojure)** for the following reasons:

1. **Proven Correctness**: The algorithm successfully handles all FHIR complexity
2. **Test Coverage**: We can use existing golden tests to ensure correctness
3. **Performance**: Single-pass algorithm with O(n) complexity
4. **Edge Cases**: Already handles slicing, choices, extensions properly
5. **TypeScript Benefits**: Can improve clarity with strong typing

### Implementation Improvements

1. **Simplified Actions**: 
   - Combine enter/enter-slice into single parameterized action
   - Add action validation

2. **Better Types**:
   ```typescript
   type Action = 
     | { type: 'enter', element: string, slice?: string }
     | { type: 'exit', element: string, slice?: string }
   ```

3. **Debugging Support**:
   - Add stack visualization
   - Action history tracking
   - Path debugging utilities

4. **Cleaner Abstractions**:
   - Separate path parser module
   - Action calculator module  
   - Stack processor module
   - Element transformer module

5. **Error Handling**:
   - Detailed error context
   - Recovery strategies
   - Validation at each step

## Consequences

### Positive
- Reliable conversion matching Clojure behavior
- Reuse existing test suite
- Known performance characteristics
- Handles all FHIR peculiarities

### Negative
- Initial complexity for developers
- Requires thorough documentation
- Debugging tools needed

### Mitigation
- Comprehensive documentation
- Visual debugging tools
- Extensive unit tests
- Code organization in modules

## Implementation Plan

1. **Phase 1**: Core algorithm structure
   - Path types and parser
   - Action types and calculator
   - Stack processor

2. **Phase 2**: Element transformation
   - Type mapping
   - Cardinality handling
   - Pattern processing

3. **Phase 3**: Special features
   - Slicing support
   - Choice type expansion
   - Extension transformation

4. **Phase 4**: Testing and refinement
   - Golden test suite
   - Performance optimization
   - Documentation

## References
- Clojure implementation: `/fhir-schema-clj/src/fhir/schema/translate.clj`
- Converter specification: `/spec/converter-specification.md`
- Converter algorithm: `/spec/converter-algorithm.md`