const {
  CSGDependencyGraph,
  CSGLayoutDependencyGraph,
  CSGCombinationDependencyGraph,
  CSGDependencyGraphEdge,
  CSGDependencyGraphNode,
} = require("../../case/csg_dependency_graph.js");

const jscad = require("@jscad/csg");
global.CSG = jscad.CSG;
global.CAG = jscad.CAG;

describe('CSGDependencyGraph', () => {
  describe('#nodeFor', () => {
    describe('arguments', () => {
      it('throws an error if passed a random object', () => {
        const graph = new CSGDependencyGraph();

        expect(() => {
          graph.nodeFor({});
        }).toThrow("Expected object to be instance of CSG or CAG.");
      });

      it('accepts a CSG object', () => {
        const graph = new CSGDependencyGraph();
        const csg = new CSG();

        expect(() => {
          graph.nodeFor(csg);
        }).not.toThrow();
      });

      it('accepts a CAG object', () => {
        const graph = new CSGDependencyGraph();
        const cag = new CAG();

        expect(() => {
          graph.nodeFor(cag);
        }).not.toThrow();
      });

      it('throws an error if passed a node from a different graph', () => {
        const originalGraph = new CSGDependencyGraph();
        const originalNode = originalGraph.nodeFor(new CSG());
        const newGraph = new CSGDependencyGraph();

        expect(() => {
          newGraph.nodeFor(originalNode);
        }).toThrow("Expected object to be instance of CSG or CAG.");
      });

      it('accepts a node from a different graph if explicitly overridden', () => {
        const originalGraph = new CSGDependencyGraph();
        const originalNode = originalGraph.nodeFor(new CSG());
        const newGraph = new CSGDependencyGraph();

        expect(() => {
          newGraph.nodeFor(originalNode, {wrapExistingNode: true});
        }).not.toThrow();
      });
    });

    it('returns a node that wraps the object', () => {
      const graph = new CSGDependencyGraph();
      const csg = new CSG();
      const node = graph.nodeFor(csg);

      expect(node.object).toBe(csg);
    });

    it('records only one node entry', () => {
      const graph = new CSGDependencyGraph();
      const csg = new CSG();
      const node = graph.nodeFor(csg);

      expect(graph.nodesByObject.size).toBe(1);
    });

    it('returns an existing node for the object', () => {
      const graph = new CSGDependencyGraph();
      const csg = new CSG();
      const originalNode = graph.nodeFor(csg);

      expect(graph.nodeFor(csg)).toBe(originalNode)
    });

    it('does not record a new node entry for an object with an existing node', () => {
      const graph = new CSGDependencyGraph();
      const csg = new CSG();
      const originalNode = graph.nodeFor(csg);

      expect(graph.nodesByObject.size).toBe(1);
    });

    it('returns an existing node for the new object after being updated by #nodeDidChangeObject', () => {
      const graph = new CSGDependencyGraph();
      const oldCSG = new CSG();
      const node = graph.nodeFor(oldCSG);

      const newCSG = new CSG();
      graph.nodeDidChangeObject(node, {old: oldCSG, "new": newCSG});

      expect(graph.nodeFor(newCSG)).toBe(node)
    });

    it('returns a new node for the new object after being updated by #nodeDidChangeObject', () => {
      const graph = new CSGDependencyGraph();
      const oldCSG = new CSG();
      const node = graph.nodeFor(oldCSG);

      const newCSG = new CSG();
      graph.nodeDidChangeObject(node, {old: oldCSG, "new": newCSG});

      expect(graph.nodeFor(oldCSG)).not.toBe(node)
    });
  });

  describe('#nodeDidChangeObject', () => {
    it('throws an error if <old> is not present', () => {
      const graph = new CSGDependencyGraph();
      const node = graph.nodeFor(new CSG());

      expect(() => {
        graph.nodeDidChangeObject(node, {old: null, new: node.object});
      }).toThrow("Expected <old> to be present.");
    });

    it('throws an error if <old> is not present', () => {
      const graph = new CSGDependencyGraph();
      const node = graph.nodeFor(new CSG());

      expect(() => {
        graph.nodeDidChangeObject(node, {old: node.nobject, new: null});
      }).toThrow("Expected <new> to be present.");
    });
  });

  describe('#addConnection', () => {
    it('throws an error if <parent> and <child> are the same', () => {
      const graph = new CSGDependencyGraph();
      const node = graph.nodeFor(new CSG());

      expect(() => {
        graph.addConnection('key', {parent: node, child: node});
      }).toThrow("Expected <parent> and <child> nodes to be distinct.");
    });

    it('throws an error if <key> is duplicated', () => {
      const graph = new CSGDependencyGraph();
      const parent = graph.nodeFor(new CSG());
      const child = graph.nodeFor(new CSG());
      graph.addConnection('key123', {parent: parent , child: child});

      expect(() => {
        // TODO: It might be even more valuable to refactor the code
        // to require that the tuple (parent, child) be unique. Also
        // then it might be possible to avoid having a key (unless we
        // want that just for ease of debugging).
        graph.addConnection('key123', {parent: parent , child: child});
      }).toThrow("Keys must be unique (<key123> already an edge)");
    });
  });

  describe('#resolve', () => {
    let graph, parent, child;
    beforeEach(() => {
      graph = new CSGDependencyGraph();
      parent = graph.nodeFor(new CSG());
      child = graph.nodeFor(new CSG());
    });

    it('calls resolve on a single edge', () => {
      const edge = new CSGDependencyGraphEdge(parent, child, {resolve: jest.fn()});
      graph.addConnection('key', {parent: parent, child: child, edge: edge});

      graph.resolve();

      expect(edge.options.resolve).toHaveBeenCalled();
    });

    it('throws an error if there is a circular dependency', () => {
      const edge1 = new CSGDependencyGraphEdge(parent, child, {resolve: jest.fn()});
      graph.addConnection('edge1', {parent: parent, child: child, edge: edge1});
      const edge2 = new CSGDependencyGraphEdge(child, parent, {resolve: jest.fn()});
      graph.addConnection('edge2', {parent: child, child: parent, edge: edge2});

      expect(() => {
        graph.resolve();
      }).toThrow("Unable to resolve dependency tree: hung with 2 edges at level 0");
    });

    it('resolves edges "node A <edge 1> node B <edge 2> node C"  in order', () => {
      const resolveCalls = [];

      const grandchild = graph.nodeFor(new CSG());
      const edge2 = new CSGDependencyGraphEdge(child, grandchild, {resolve: () => resolveCalls.push("edge 2")});
      graph.addConnection('edge 2', {parent: child, child: grandchild, edge: edge2});
      const edge1 = new CSGDependencyGraphEdge(parent, child, {resolve: () => resolveCalls.push("edge 1")});
      graph.addConnection('edge 1', {parent: parent, child: child, edge: edge1});

      graph.resolve();

      expect(resolveCalls).toEqual(['edge 1', 'edge 2'])
    });

    it('resolves multiple children of a parent', () => {
      const resolveCalls = [];

      const otherChild = graph.nodeFor(new CSG());
      const edge2 = new CSGDependencyGraphEdge(parent, otherChild, {resolve: () => resolveCalls.push("edge 2")});
      graph.addConnection('edge 2', {parent: parent, child: otherChild, edge: edge2});
      const edge1 = new CSGDependencyGraphEdge(parent, child, {resolve: () => resolveCalls.push("edge 1")});
      graph.addConnection('edge 1', {parent: parent, child: child, edge: edge1});

      graph.resolve();

      expect(resolveCalls.sort()).toEqual(['edge 1', 'edge 2'])
    });

    it('resolves multiple direct parents of a single child before descendants of that child', () => {
      const resolveCalls = [];

      const otherParent = graph.nodeFor(new CSG());
      const grandchild = graph.nodeFor(new CSG());

      graph.addConnection('descendant', {parent: child, child: grandchild, edge:
        new CSGDependencyGraphEdge(child, grandchild, {resolve: () => resolveCalls.push("descendant")},
      )});
      graph.addConnection('parent 2', {parent: parent, child: child, edge:
        new CSGDependencyGraphEdge(parent, child, {resolve: () => resolveCalls.push("parent 2")},
      )});
      graph.addConnection('parent 1', {parent: otherParent, child: child, edge:
        new CSGDependencyGraphEdge(otherParent, child, {resolve: () => resolveCalls.push("parent 1")},
      )});

      graph.resolve();

      expect(resolveCalls.slice(0, 2).sort()).toEqual(['parent 1', 'parent 2'])
      expect(resolveCalls[2]).toEqual('descendant')
    });
  });
});

describe('CSGDependencyGraphNode', () => {
  describe('#object', () => {
    it('returns the CSG object passed at construction', () => {
      const csg = new CSG();
      const node = new CSGDependencyGraphNode(null, csg);
      expect(node.object).toBe(csg);
    });

    it('returns the CSG object after it has be set manually', () => {
      const graph = new CSGDependencyGraph();
      const originalCSG = new CSG();
      const node = graph.nodeFor(originalCSG);

      const newCSG = new CSG();
      node.object = newCSG;

      expect(node.object).not.toBe(originalCSG);
      expect(node.object).toBe(newCSG);
    });

    it('returns the CSG object from a wrapped node', () => {
      const graph = new CSGDependencyGraph();
      const csg = new CSG();
      const originalNode = graph.nodeFor(csg);

      const wrappingNode = new CSGDependencyGraphNode(null, originalNode);

      expect(wrappingNode.object).toBe(csg);
    });
  });
});

describe('CSGDependencyGraphEdge', () => {
  describe('#resolve', () => {
    it('calls the provided resolution function', () => {
      const graph = new CSGDependencyGraph();
      const parent = graph.nodeFor(new CSG());
      const child = graph.nodeFor(new CSG());

      const resolveFn = jest.fn()
      const edge = new CSGDependencyGraphEdge(parent, child, {resolve: resolveFn});
      edge.resolve();

      expect(resolveFn.mock.calls).toEqual([[edge]]);
    });

    it('throws an error if the resolve argument is not a function', () => {
      const graph = new CSGDependencyGraph();
      const parent = graph.nodeFor(new CSG());
      const child = graph.nodeFor(new CSG());

      expect(() => {
        new CSGDependencyGraphEdge(parent, child, {resolve: "bogus"});
      }).toThrow("Expected <resolve> to be passed in construction of CSGDependencyGraphEdge");
    });
  });
});

describe('CSGLayoutDependencyGraph', () => {
  describe('#addConnection', () => {
    it('throws an error if the parent and child arguments are not arrays', () => {
      const graph = new CSGLayoutDependencyGraph();
      const node = graph.nodeFor(new CSG());

      expect(() => {
        graph.addConnection('key', {parent: null, child: null});
      }).toThrow("Expected <parent> to be an array containing [node, property connector name]. Expected <child> to be an array containing [node, property connector name].");
    });

    it('throws an error if the parent and child arguments are not arrays of length 2', () => {
      const graph = new CSGLayoutDependencyGraph();
      const node = graph.nodeFor(new CSG());

      expect(() => {
        graph.addConnection('key', {parent: [], child: []});
      }).toThrow("Expected <parent> to be an array containing [node, property connector name]. Expected <child> to be an array containing [node, property connector name].");
    });
  });

  describe('#resolve', () => {
    it('connects the two objects so they have the correct layout', () => {
      const graph = new CSGLayoutDependencyGraph();
      const parent = graph.nodeFor(CSG.cube({radius: [5, 5, 5]}));
      parent.object.properties.connector = new CSG.Connector(new CSG.Vector3D([0, 0, 0]), [0, 0, 1], [0, 1, 0]);
      const child = graph.nodeFor(CSG.cube({radius: [5, 5, 5]}));
      child.object.properties.connector = new CSG.Connector(new CSG.Vector3D([5, 5, 5]), [0, 0, 1], [0, 1, 0]);
      graph.addConnection('key', {parent: [parent, 'connector'], child: [child, 'connector']});

      graph.resolve();

      expect(child.object.properties.connector.point).toEqual(new CSG.Vector3D([0, 0, 0]));
    });

    it('updates the object-to-node mapping in the graph with graph#nodeDidChangeObject', () => {
      const graph = new CSGLayoutDependencyGraph();
      const parent = graph.nodeFor(new CSG());
      parent.object.properties.connector = new CSG.Connector(new CSG.Vector3D([0, 0, 0]), [0, 0, 1], [0, 1, 0]);
      const child = graph.nodeFor(new CSG());
      child.object.properties.connector = new CSG.Connector(new CSG.Vector3D([5, 5, 5]), [0, 0, 1], [0, 1, 0]);
      graph.addConnection('key', {parent: [parent, 'connector'], child: [child, 'connector']});

      const nodeDidChangeObject = graph.nodeDidChangeObject;
      graph.nodeDidChangeObject = jest.fn((node, opts) => {
        nodeDidChangeObject.apply(graph, [node, opts]);
      });

      graph.edgesByKey.get('key').resolve();

      expect(graph.nodeDidChangeObject).toHaveBeenCalled();
    });
  });
});

describe('CSGCombinationDependencyGraph', () => {
  describe('#resolve', () => {
    it('unions two objects', () => {
      const graph = new CSGCombinationDependencyGraph();
      const parent = graph.nodeFor(CSG.cube({radius: [5, 5, 5]}));
      const child = graph.nodeFor(
        CSG.cube({radius: [5, 5, 5]}).translate([0, 0, 5])
      );
      graph.addConnection('key', {parent: parent, child: child, operation: "union"});

      graph.resolve();

      expect(child.object.getBounds()).toEqual([
        new CSG.Vector3D([-5, -5, -5]),
        new CSG.Vector3D([5, 5, 10])
      ]);
    });

    it('subtracts two objects', () => {
      const graph = new CSGCombinationDependencyGraph();
      const minuend = graph.nodeFor(CSG.cube({radius: [5, 5, 10]}));
      const subtrahend = graph.nodeFor(
        CSG.cube({radius: [5, 5, 5]}).translate([0, 0, 5])
      );
      // Perhaps unintuitively the parent is the subtrahend and the
      // minuend is the child; even though you'd naturally think of
      // this as `parent - child`, it has to be the `child - parent`
      // since otherwise the result (which is always stored in the
      // child) rarely, if ever, makes sense for use in future
      // operations.
      graph.addConnection('key', {parent: subtrahend, child: minuend, operation: "subtract"});

      graph.resolve();

      expect(minuend.object.getBounds()).toEqual([
        new CSG.Vector3D([-5, -5, -10]),
        new CSG.Vector3D([5, 5, 0])
      ]);
    });

    it('intersects two objects', () => {
      const graph = new CSGCombinationDependencyGraph();
      const parent = graph.nodeFor(
        CSG.cube({radius: [5, 5, 10]}).translate([0, 0, -5])
      );
      const child = graph.nodeFor(
        CSG.cube({radius: [5, 5, 10]}).translate([0, 0, 5])
      );
      graph.addConnection('key', {parent: parent, child: child, operation: "intersect"});

      graph.resolve();

      expect(child.object.getBounds()).toEqual([
        new CSG.Vector3D([-5, -5, -5]),
        new CSG.Vector3D([5, 5, 5])
      ]);
    });

    it('updates the object-to-node mapping in the graph with graph#nodeDidChangeObject', () => {
      const graph = new CSGCombinationDependencyGraph();
      const parent = graph.nodeFor(new CSG());
      const child = graph.nodeFor(new CSG());
      graph.addConnection('key', {parent: parent, child: child, operation: "union"});

      const nodeDidChangeObject = graph.nodeDidChangeObject;
      graph.nodeDidChangeObject = jest.fn((node, opts) => {
        nodeDidChangeObject.apply(graph, [node, opts]);
      });

      graph.edgesByKey.get('key').resolve();

      expect(graph.nodeDidChangeObject).toHaveBeenCalled();
    });
  });
});
