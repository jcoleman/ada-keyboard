class CSGDependencyGraph {
  constructor(opts = {
    resolveEdge: (edge) => {
      throw new Error("Expected <resolveEdge> to be passed for construction of CSGDependencyGraph");
    },
  }) {
    var errors = [];
    if (typeof(opts.resolveEdge) !== "function") {
      errors.push("Expected <resolveEdge> to be passed in construction of CSGDependencyGraph");
    }
    if (errors.length > 0) {
      throw new Error(errors.join(". ") + ".");
    }

    this.edgesByKey = new Map();
    this.nodesByObject = new Map();
    this.resolveEdge = opts.resolveEdge;
  }

  addConnection(key, opts={
    parent: null, // <node>
    child: null, // <node>
    edge: null, // (subclass) instance of CSGDependencyGraphEdge
  }) {
    var self = this;
    if (this.edgesByKey.has(key)) {
      throw new Error("Keys must be unique");
    }
    var optsErrors = ["parent", "child"].reduce(function(errors, key) {
      if (!(opts[key] instanceof CSGDependencyGraphNode)) {
        errors.push("Expected <" + key + "> node to be an instance of CSGDependencyGraphNode");
      } else if (opts[key].dependencyGraph !== self) {
        errors.push("Expected <" + key + "> node to have already been added to this instance of CSGDependencyGraph via <nodeForObject>");
      }
      return errors;
    }, []);
    if (opts.parent === opts.child) {
      optsErrors.push("Expected <parent> and <child> nodes to be distinct");
    }
    if (optsErrors.length > 0) {
      throw new Error(optsErrors.join(". ") + ".");
    }

    this.edgesByKey.set(key, opts.edge);
  }

  nodeFor(object, opts={wrapExistingNode: false}) {
    if (
      !((object instanceof CSG) || (object instanceof CAG))
      && !(object instanceof CSGDependencyGraphNode && opts.wrapExistingNode)
    ) {
      throw new Error("Expected object to be instance of CSG or CAG.");
    }

    var node = this.nodesByObject.get(object);
    if (!node) {
      node = new CSGDependencyGraphNode(this, object);
      this.nodesByObject.set(object, node);
    }
    return node;
  }

  nodeDidChangeObject(node, opts={old: null, "new": null}) {
    var optsErrors = ["old", "new"].reduce(function(errors, key) {
      if (!opts[key]) {
        errors.push("Expected <" + key + "> to be present");
      }
      return errors;
    }, []);
    if (optsErrors.length > 0) {
      throw new Error(optsErrors.join(". ") + ".");
    }

    this.nodesByObject.delete(opts.old);
    this.nodesByObject.set(opts["new"], node);
  }

  resolve() {
    var self = this;

    // Depth-first traversal.
    var remainingEdges = Array.from(this.edgesByKey.values());

    for (var level = 0; remainingEdges.length > 0; ++level) {
      var incomingEdgesByParent = new Map();
      for (var edge of remainingEdges) {
        incomingEdgesByParent.set(edge.parent, []);
      }
      for (var edge of remainingEdges) {
        // A child node from one of these edges being the same node
        // as the parent implies that that parent node is dependent
        // on that edge's child (or is an incoming edge).
        if (incomingEdgesByParent.has(edge.child)) {
          incomingEdgesByParent.get(edge.child).push(edge);
        }
      }

      var roots = [];
      var dependents = [];
      for (var edge of remainingEdges) {
        var incomingEdges = incomingEdgesByParent.get(edge.parent);
        if (incomingEdges.length == 0) {
          roots.push(edge);
        } else {
          dependents.push(edge);
        }
      }

      for (var root of roots) {
        root.resolve();
      }

      if (roots.length == 0 && dependents.length > 0) {
        throw new Error("Unable to resolve dependency tree: hung with " + String(dependents.length) + " edges at level " + String(level));
      }
      remainingEdges = dependents;
    }
  }
}

class CSGLayoutDependencyGraph extends CSGDependencyGraph {
  constructor(opts = {}) {
    super(Object.assign({}, opts, {
      resolveEdge: (edge) => {
        // TODO: handle subtree
        var updated = edge.child.object.connectTo(
          edge.child.object.properties[edge.childPropertyName],
          edge.parent.object.properties[edge.parentPropertyName],
          edge.options.mirror,
          edge.options.rotationFromNormal
        );
        edge.child.object = updated;
      }
    }));
  }

  addConnection(key, opts={
    parent: [null, ""], // [<node>, <connector name>]
    child: [null, ""], // [<node>, <connector name>]
    mirror: false,
    rotationFromNormal: 0,
  }) {
    var self = this;
    var optsErrors = ["parent", "child"].reduce(function(errors, key) {
      if (!(Array.isArray(opts[key]) && opts[key].length == 2)) {
        errors.push("Expected <" + key + "> to be an array containing [node, property connector name]");
      }
      return errors;
    }, []);
    if (optsErrors.length > 0) {
      throw new Error(optsErrors.join(". ") + ".");
    }

    const edge = new CSGLayoutDependencyGraphEdge(
      opts.parent,
      opts.child,
      {
        mirror: opts.mirror,
        rotationFromNormal: opts.rotationFromNormal,
        resolve: this.resolveEdge,
      }
    );

    super.addConnection(key, {parent: opts.parent[0], child: opts.child[0], edge: edge});
  }
}

// Typically you'd expect a tree to be structured like:
//
//          A
//        /   \
//      <op> <op>
//       /     \
//      B       C
//
// with B and C both dependent on A but as separately
// useful result values.
//
// For combination operations, however, the tree tends to be
// inverted so that it's structured like:
//
//      B       C
//       \     /
//      <op> <op>
//        \   /
//          A
//
// with A dependent on both B and C because you want one
// final result value.
class CSGCombinationDependencyGraph extends CSGDependencyGraph {
  constructor(opts = {}) {
    super(Object.assign({}, opts, {
      resolveEdge: (edge) => {
        // TODO: handle subtree
        const operation = edge.options.operation;
        var updated;
        if (operation == "subtract") {
          // Subtract operations are special because of the inverted
          // nature of the tree.
          updated = edge.child.object[operation](edge.parent.object);
        } else {
          // TODO: for some reason if we do the operations with args
          // (child, parent) instead of (parent, child) there are slight
          // but visible differences in output even though they should
          // be conceptually commuative.
          updated = edge.parent.object[operation](edge.child.object);
        }
        edge.child.object = updated;
      }
    }));
  }

  addConnection(key, opts={
    parent: null, // <node>
    child: null, // <node>
    operation: null, // "intersect", "union", or "subtract"
  }) {
    if (!["intersect", "union", "subtract"].includes(opts.operation)) {
      throw new Error("Expected <operation> to be 'intersect', 'union', or 'subtract'");
    }
    const edge = new CSGDependencyGraphEdge(
      opts.parent,
      opts.child,
      {
        resolve: this.resolveEdge,
        operation: opts.operation,
      }
    );

    super.addConnection(key, {parent: opts.parent, child: opts.child, edge: edge});
  }
}

class CSGDependencyGraphNode {
  constructor(dependencyGraph, object) {
    this.dependencyGraph = dependencyGraph;
    this._object = object;
  }

  get object() {
    return this._object instanceof CSGDependencyGraphNode ? this._object.object : this._object;
  }

  set object(object) {
    this.dependencyGraph.nodeDidChangeObject(this, {old: this.object, "new": object});
    return this._object = object;
  }
}

class CSGDependencyGraphEdge {
  constructor(parent, child, opts={resolve: null}) {
    var self = this;
    opts = opts || {};

    this.parent = parent;
    this.child = child;
    this.resolverImplementation = opts.resolve;
    var errors = [];
    if (typeof(opts.resolve) !== "function") {
      errors.push("Expected <resolveEdge> to be passed in construction of CSGDependencyGraph");
    }
    if (errors.length > 0) {
      throw new Error(errors.join(" "));
    }
    this.options = opts;
  }

  resolve() {
    this.resolverImplementation(this);
  }
}

class CSGLayoutDependencyGraphEdge extends CSGDependencyGraphEdge {
  constructor(parent=[null, "propertyName"], child=[null, "propertyName"], opts={resolve: null}) {
    super(parent[0], child[0], opts);

    var self = this;
    opts = opts || {};

    this.parentPropertyName = parent[1];
    this.childPropertyName = child[1];
    var errors = ["parent", "child"].reduce(function(errors, argumentName) {
      var propertyName = self[argumentName + "PropertyName"];
      if (typeof propertyName !== "string") {
        errors.push("Expected <" + argumentName + "[1]> (connector property name) to be a String.");
      } else if (!self[argumentName].object.properties.hasOwnProperty(propertyName)) {
        errors.push("Tried to add connection with " + argumentName + " property <" + propertyName + "> but parent object does not contain that property.");
      }
      return errors;
    }, []);
    if (errors.length > 0) {
      throw new Error(errors.join(" "));
    }
  }
}

var moduleExports;
if (typeof(self) == "object" && typeof(exports) == "undefined") {
  // Shim since OpenJSCAD's `include` eval's the code and classes
  // inside an eval scope are not defined outside of that scope.
  moduleExports = self;
} else {
  moduleExports = exports;
}
moduleExports.CSGDependencyGraph = CSGDependencyGraph;
moduleExports.CSGLayoutDependencyGraph = CSGLayoutDependencyGraph;
moduleExports.CSGCombinationDependencyGraph = CSGCombinationDependencyGraph;
moduleExports.CSGDependencyGraphEdge = CSGDependencyGraphEdge;
moduleExports.CSGDependencyGraphNode = CSGDependencyGraphNode;
