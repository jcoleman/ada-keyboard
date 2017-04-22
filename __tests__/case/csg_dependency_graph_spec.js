require("../../case/csg_dependency_graph.jscad")
var jscad = require("@jscad/csg")
CSG = jscad.CSG
CAG = jscad.CAG

describe('CSGDependencyGraph', () => {
  describe('#nodeFor', () => {
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
      node.object.properties.connector = new CSG.Connector(new CSG.Vector3D([0, 0, 0]), [0, 0, 1], [0, 1, 0]);

      expect(() => {
        graph.addConnection('key', {parent: [node, 'connector'], child: [node, 'connector']});
      }).toThrow("Expected <parent> and <child> nodes to be distinct.");
    });
  });

  describe('#resolve', () => {
    let graph, parent, child;
    beforeEach(() => {
      graph = new CSGDependencyGraph();
      parent = graph.nodeFor(new CSG());
      parent.object.properties.connector = new CSG.Connector(new CSG.Vector3D([0, 0, 0]), [0, 0, 1], [0, 1, 0]);
      child = graph.nodeFor(new CSG());
      child.object.properties.connector = new CSG.Connector(new CSG.Vector3D([5, 5, 5]), [0, 0, 1], [0, 1, 0]);
    });

    it('calls resolve on a single edge', () => {
      graph.addConnection('key', {parent: [parent, 'connector'], child: [child, 'connector']});
      const edge = graph.edgesByKey.get('key');
      edge.resolve = jest.fn();

      graph.resolve();

      expect(edge.resolve).toHaveBeenCalled();
    });

    it('throws an error if there is a circular dependency', () => {
      graph.addConnection('edge1', {parent: [parent, 'connector'], child: [child, 'connector']});
      graph.addConnection('edge2', {parent: [child, 'connector'], child: [parent, 'connector']});

      expect(() => {
        graph.resolve();
      }).toThrow("Unable to resolve dependency tree: hung with 2 edges at level 0");
    });

    it('resolves edges "node A <edge 1> node B <edge 2> node C"  in order', () => {
      const grandchild = graph.nodeFor(new CSG());
      grandchild.object.properties.connector = new CSG.Connector(new CSG.Vector3D([5, 5, 5]), [0, 0, 1], [0, 1, 0]);

      graph.addConnection('edge 2', {parent: [child, 'connector'], child: [grandchild, 'connector']});
      graph.addConnection('edge 1', {parent: [parent, 'connector'], child: [child, 'connector']});

      const resolveCalls = [];
      graph.edgesByKey.forEach((edge, key) => {
        edge.resolve = jest.fn(() => resolveCalls.push(key));
      });

      graph.resolve();

      expect(resolveCalls).toEqual(['edge 1', 'edge 2'])
    });

    it('resolves multiple children of a parent', () => {
      const otherChild = graph.nodeFor(new CSG());
      otherChild.object.properties.connector = new CSG.Connector(new CSG.Vector3D([5, 5, 5]), [0, 0, 1], [0, 1, 0]);

      graph.addConnection('edge 2', {parent: [parent, 'connector'], child: [otherChild, 'connector']});
      graph.addConnection('edge 1', {parent: [parent, 'connector'], child: [child, 'connector']});

      const resolveCalls = [];
      graph.edgesByKey.forEach((edge, key) => {
        edge.resolve = jest.fn(() => resolveCalls.push(key));
      });

      graph.resolve();

      expect(resolveCalls.sort()).toEqual(['edge 1', 'edge 2'])
    });

    it('resolves multiple direct parents of a single child before descendants of that child', () => {
      const otherParent = graph.nodeFor(new CSG());
      otherParent.object.properties.connector = new CSG.Connector(new CSG.Vector3D([5, 5, 5]), [0, 0, 1], [0, 1, 0]);
      const grandchild = graph.nodeFor(new CSG());
      grandchild.object.properties.connector = new CSG.Connector(new CSG.Vector3D([5, 5, 5]), [0, 0, 1], [0, 1, 0]);

      graph.addConnection('descendant', {parent: [child, 'connector'], child: [grandchild, 'connector']});
      graph.addConnection('parent 2', {parent: [parent, 'connector'], child: [child, 'connector']});
      graph.addConnection('parent 1', {parent: [otherParent, 'connector'], child: [child, 'connector']});

      const resolveCalls = [];
      graph.edgesByKey.forEach((edge, key) => {
        edge.resolve = jest.fn(() => resolveCalls.push(key));
      });

      graph.resolve();

      expect(resolveCalls.slice(0, 2).sort()).toEqual(['parent 1', 'parent 2'])
      expect(resolveCalls[2]).toEqual('descendant')
    });
  });
});
