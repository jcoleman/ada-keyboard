class _CSGDependencyGraph {
  constructor() {
    this.edgesByKey = new Map();
    this.nodesByObject = new Map();
  }

  addConnection(key, opts={
    parent: [null, ""], // [<node>, <connector name>]
    child: [null, ""], // [<node>, <connector name>]
    mirror: false,
    rotationFromNormal: 0,
  }) {
    var self = this;
    if (this.edgesByKey.has(key)) {
      throw new Error("Keys must be unique");
    }
    var optsErrors = ["parent", "child"].reduce(function(errors, key) {
      if (!(Array.isArray(opts[key]) && opts[key].length == 2)) {
        errors.push("Expected <" + key + "> to be an array containing [node, property connector name]");
      } else if (!(opts[key][0] instanceof CSGDependencyGraphNode)) {
        errors.push("Expected <" + key + "> node to be an instance of CSGDependencyGraphNode");
      } else if (opts[key][0].dependencyGraph !== self) {
        errors.push("Expected <" + key + "> node to have already been added to this instance of CSGDependencyGraph via <nodeForObject>");
      }
      return errors;
    }, []);
    if (optsErrors.length > 0) {
      throw new Error(optsErrors.join(". "));
    }

    this.edgesByKey.set(key, new CSGDependencyGraphEdge(
      opts.parent,
      opts.child,
      {
        mirror: opts.mirror,
        rotationFromNormal: opts.rotationFromNormal,
      }
    ));

    // TODO only allow one parent per child
  }

  nodeFor(object) {
    if (!((object instanceof CSG) || (object instanceof CAG))) {
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

class _CSGDependencyGraphNode {
  constructor(dependencyGraph, object) {
    this.dependencyGraph = dependencyGraph;
    this.object = object;
  }

  get object() {
    return this._object;
  }

  set object(object) {
    this.dependencyGraph.nodeDidChangeObject({old: this.object, "new": object});
    return this._object = object;
  }
}

class CSGDependencyGraphEdge {
  constructor(parent=[null, "propertyName"], child=[null, "propertyName"], opts={}) {
    var self = this;

    this.parent = parent[0];
    this.parentPropertyName = parent[1];
    this.child = child[0];
    this.childPropertyName = child[1];
    var errors = ["parent", "child"].reduce(function(errors, argumentName) {
      var propertyName = self[argumentName + "PropertyName"];
      if (typeof propertyName !== "string") {
        errors.push("Expected <" + propertyName + "> to be a String.");
      } else if (!self[argumentName].object.properties.hasOwnProperty(propertyName)) {
        errors.push("Tried to add connection with " + argumentName + " property <" + propertyName + "> but parent object does not contain that property.");
      }
      return errors;
    }, []);
    if (errors.length > 0) {
      throw new Error(errors.join(" "));
    }
    this.options = opts;
  }

  resolve() {
    // TODO: handle subtree
    var updated = this.child.object.connectTo(
      this.child.object.properties[this.childPropertyName],
      this.parent.object.properties[this.parentPropertyName],
      this.options.mirror,
      this.options.rotationFromNormal
    );
    this.child.object = updated;
  }
}

// Shim since OpenJSCAD's `include` eval's the code and classes
// inside an eval scope are not defined outside of that scope.
CSGDependencyGraph = _CSGDependencyGraph;
CSGDependencyGraphNode = _CSGDependencyGraphNode;
