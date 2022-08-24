import { ITreeModelOptions, PolyTreeDirection } from "../interfaces/tree_interfaces";

export class PolyTreeUtilities {
    /**
     * Build tree structure with the real data
     * @param tree Tree structure
     * @param data Data dictionary
     * @param direction PolyTreeDirection
     * @param options ITreeModelOptions
     * @returns Object
     */
  static buildTree(
    tree: any | any[],
    data: any[],
    direction: PolyTreeDirection,
    options: ITreeModelOptions,
  ) {
    if (Array.isArray(tree)) {
      return tree.map((node) => {
        let nodeData = this.getData(node, data, options);
        if (node[direction] != undefined) {
          nodeData[direction] = this.buildTree(
            node[direction],
            data,
            direction,
            options,
          );

          if(direction == 'siblings'){
            nodeData[direction] = nodeData[direction].map(({siblings, ...e} : any)=> e)
          }
        }
        return nodeData;
      });
    } else {
      if (tree != undefined) {
        let nodeData = this.getData(tree, data, options);
        if (tree[direction] != undefined) {
          nodeData[direction] = this.buildTree(
            tree[direction],
            data,
            direction,
            options,
          );
        }
        return nodeData;
      }
    }
  }

  /**
   * Get data for a node
   * @param node Tree node data
   * @param data Data dictionary
   * @param options ITreeModelOptions
   * @returns object
   */
  static getData(node: any, data: any[], options: ITreeModelOptions) {
    for (var i = 0; i < data.length; i++) {
      if (node[options.typeColumn] == data[i][0].type) {
        return data[i].find((e: any) => e.id == node[options.idColumn]);
      }
    }
  }

  /**
   * Map tree data to a data dictionary
   * @param tree Tree structure
   * @param direction PolyTreeDirection
   * @param options ITreeModelOptions
   * @returns Map
   */
  static mapIdToTable(
    tree: any[] | any,
    direction: PolyTreeDirection,
    options: ITreeModelOptions,
  ) {
    if (Array.isArray(tree)) {
      if (tree.length < 1) {
        return [];
      }
    } else {
      tree = [tree];
    }

    let map: any = [];
    tree.map((entity: any) => {
      if (map[entity[options.typeColumn]] == null) {
        map.push({
          table: entity[options.typeColumn],
          ids: [entity[options.idColumn]],
        });
        if (entity[direction] != null) {
          map = map.concat(
            this.mapIdToTable(entity[direction], direction, options),
          );
        }
      }
    });

    let result: { table: string; ids: string[] }[] = [];

    // watch out O(n^2)
    for (var i = 0; i < map.length; i++) {
      if (result.length == 0) {
        result.push(map[i]);
        continue;
      }

      let found: { found: boolean; index: number } = { found: false, index: 0 };

      for (var j = 0; j < result.length; j++) {
        if (result[j].table == map[i].table) {
          found.found = true;
          found.index = j;
          break;
        }
      }

      found.found
        ? (result[found.index].ids = result[found.index].ids.concat(map[i].ids))
        : result.push(map[i]);
    }

    return result;
  }
}
