import {
  DeepPartial,
  FindManyOptions,
  FindTreeOptions,
  In,
  Repository,
  SaveOptions,
} from 'typeorm';
import { TREE_KEY, TREE_KEY_SEPARATOR } from '../constant/constant';
import { ITreeModelOptions } from '../interfaces/tree_interfaces';
import { PolyTreeUtilities } from '../util/tree_utilities';


export class PolyTreeRepository<E> extends Repository<E> {
  /**
   * Check if an entity is a poly tree entity
   * @returns boolean
   */
  isTree() {
    return Reflect.getMetadata(
      TREE_KEY,
      (this.metadata.target as Function)['prototype'],
    );
  }

  /**
   * Insert polytree data. Update will only update the data but not tree structure 
   * until further implementation.
   * @param entities 
   * @param options 
   */
  save<T extends DeepPartial<E>>(
    entities: T[],
    options: SaveOptions & { reload: false },
  ): Promise<T[]>;
  save<T extends DeepPartial<E>>(
    entities: T[],
    options?: SaveOptions,
  ): Promise<(T & E)[]>;
  save<T extends DeepPartial<E>>(
    entity: T,
    options: SaveOptions & { reload: false },
  ): Promise<T>;
  save<T extends DeepPartial<E>>(
    entity: T,
    options?: SaveOptions,
  ): Promise<T & E>;
  async save<T extends DeepPartial<E>>(
    entity: T | Array<T>,
    options?: SaveOptions,
  ): Promise<T[] | (T & E)[] | Promise<T> | Promise<T & E>> {
    if (!this.isTree()) {
      return Array.isArray(entity)
        ? super.save(entity, options)
        : super.save(entity, options);
    }
    const modelOptions = this.getTreeModelOptions();

    const id = entity.hasOwnProperty('id') ? entity : null;
    // if already have id must be an "update" operation
    if (id != null) {
      return Array.isArray(entity)
        ? super.save(entity, options)
        : super.save(entity, options);
    }

    let entities = Array.isArray(entity) ? entity : [entity];
    let data = await Promise.all(
      entities.map(async (entity) => {
        // detect if parent is exist in this model
        let parentKey = this.findParentKey();
        let key =
          parentKey.length > 0
            ? this.getPropertyFromTreeMetadataKey(parentKey[0])
            : undefined;
        let parent: any =
          key === undefined ? undefined : entity[key as keyof typeof entity];

        // store data
        let newData: any = await super.save(entity, options);
        // create node in tree based on data
        const Table = this.getTreeModel();
        let node = new Table();
        node[modelOptions.idColumn] = newData.id;
        node[modelOptions.typeColumn] = newData.constructor.name;

        // assign parent
        if (parent != undefined) {
          // get parent id
          let ownParent = await this.getTreeModelRepository().findOneBy({
            [modelOptions.idColumn]: parent.id,
            [modelOptions.typeColumn]: parent.constructor.name,
          });
          // error if parent is not existed
          if (ownParent == undefined) {
            throw new Error('Parent not registered');
          }
          node.parent = ownParent;
        }

        await this.manager.save(node);
        return newData;
      }),
    );

    return data;
  }


  /**
   * get all roots object
   * @param options FindTreeOptions
   * @returns array
   */
  async findRoot(options: FindTreeOptions) {
    let tree = await this.manager
      .getTreeRepository(this.getTreeModel())
      .findRoots(options);

    const treeData = PolyTreeUtilities.mapIdToTable(
      tree,
      'parent',
      this.getTreeModelOptions(),
    );

    const data = await this.getTreeData(treeData);
    return PolyTreeUtilities.buildTree(
      tree,
      data,
      'parent',
      this.getTreeModelOptions(),
    );
  }

  /**
   * Get parent object from entity
   * @param options TypeORM's Find Many Options
   * @returns array
   */
  async findParent(options?: FindManyOptions<E>): Promise<E[]> {
    if (!this.isTree()) {
      throw new Error('Model does not have tree property');
    }

    let entities = await this.find(options);

    const ids = entities.map((entity: any) => {
      return entity.id;
    });

    const root = await this.getTreeModelRepository().find({
      where: {
        [this.getTreeModelOptions().idColumn]: In(ids),
      },
    });

    const tree = await Promise.all(
      root.map(async (node) => {
        return await this.manager
          .getTreeRepository(this.getTreeModel())
          .findAncestorsTree(node);
      }),
    );

    const treeData = PolyTreeUtilities.mapIdToTable(
      tree,
      'parent',
      this.getTreeModelOptions(),
    );

    const data = await this.getTreeData(treeData);
    return PolyTreeUtilities.buildTree(
      tree,
      data,
      'parent',
      this.getTreeModelOptions(),
    );
  }

  /**
   * Get children of an entity
   * @param options TypeOrm's Find Many Options
   * @returns array
   */
  async findChildren(options?: FindManyOptions<E>): Promise<E[]> {
    if (!this.isTree()) {
      throw new Error('Model does not have tree property');
    }
    let entities = await this.find(options);

    const ids = entities.map((entity: any) => {
      return entity.id;
    });

    const root = await this.getTreeModelRepository().find({
      where: {
        [this.getTreeModelOptions().idColumn]: In(ids),
      },
    });

    const tree = await Promise.all(
      root.map(async (node) => {
        return await this.manager
          .getTreeRepository(this.getTreeModel())
          .findDescendantsTree(node);
      }),
    );

    const treeData = PolyTreeUtilities.mapIdToTable(
      tree,
      'child',
      this.getTreeModelOptions(),
    );
    const data = await this.getTreeData(treeData);
    return PolyTreeUtilities.buildTree(
      tree,
      data,
      'child',
      this.getTreeModelOptions(),
    );
  }

  /**
   * Get actual data from a tree node
   * @param data 
   * @returns 
   */
  private async getTreeData(data: any[]) {
    return Promise.all(
      data.map(async (item: any) => {
        return await this.manager.getRepository(item.table).find({
          where: {
            id: In(item.ids),
          },
        });
      }),
    );
  }

  /**
   * Find sibling from an entity or entities
   * @param options TypeORM's FindManyOptions
   * @returns array
   */
  async findSiblings(options?: FindManyOptions) {
    if (!this.isTree()) {
      throw new Error('Model does not have tree property');
    }

    let entities = await this.find(options);

    const ids = entities.map((entity: any) => {
      return entity.id;
    });

    const trees = await this.getTreeModelRepository().find({
      where: {
        node_id: In(ids),
      },
    });

    const parents = await Promise.all(
      trees.map(async (node) => {
        return await this.manager
          .getTreeRepository(this.getTreeModel())
          .findAncestorsTree(node);
      }),
    );

    let tree = await Promise.all(
      parents.map(async (node) => {
        const parent = await this.manager
          .getTreeRepository(this.getTreeModel())
          .findDescendantsTree(node.parent, { depth: 1 });
        const sibling = parent.child.filter(
          (child: any) => child.node_id != node.node_id,
        );
        const newData = {
          ...node,
          siblings: sibling,
        };
        return newData;
      }),
    );

    const treeData = PolyTreeUtilities.mapIdToTable(
      tree,
      'siblings',
      this.getTreeModelOptions(),
    );

    const data = await this.getTreeData(treeData);
    const result =  PolyTreeUtilities.buildTree(
      tree,
      data,
      'siblings',
      this.getTreeModelOptions(),
    );

    return result
  }

  /**
   * Find model parents properties from metadata
   * @returns 
   */
  private findParentKey() {
    let target = (this.metadata.target as Function)['prototype'];
    return Reflect.getMetadataKeys(target).filter((value) => {
      let metadatas = value.split(TREE_KEY_SEPARATOR);
      if (metadatas.length == 2) {
        let metadata = Reflect.getMetadata(value, target);
        if (metadata.type == 'parent') {
          return true;
        }
        return false;
      } else {
        return false;
      }
    });
  }

  /**
   * Get specific poly tree metadata
   * @param key metadata key
   * @returns string | undefined
   */
  private getPropertyFromTreeMetadataKey(key: String) {
    let data = key.split(TREE_KEY_SEPARATOR);
    return data.length == 2 ? data[1] : undefined;
  }

  /**
   * Get repository of a tree model
   * @returns repository
   */
  private getTreeModelRepository() {
    const target = this.metadata.target as Function;
    let data = Reflect.getMetadata(`${TREE_KEY}::TABLE`, target) as Function;
    return this.manager.getRepository(data());
  }

  /**
   * Return tree model configured in @Tree decorator
   * @returns object
   */
  private getTreeModel() {
    const target = this.metadata.target as Function;
    let data = Reflect.getMetadata(`${TREE_KEY}::TABLE`, target) as Function;
    return data();
  }

  /**
   * Get tree model options configured in @Tree decorator
   * @returns ITreeModelOptions
   */
  private getTreeModelOptions(): ITreeModelOptions {
    const target = this.metadata.target as Function;
    return Reflect.getMetadata(`${TREE_KEY}::OPTIONS`, target);
  }

}
