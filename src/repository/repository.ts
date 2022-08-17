import {
  DeepPartial,
  FindManyOptions,
  FindTreeOptions,
  ObjectLiteral,
  Repository,
  SaveOptions,
} from "typeorm";
import { TREE_KEY, TREE_KEY_SEPARATOR } from "../constant/constant";
import { ITreeModelOptions } from "../interfaces/tree_interfaces";

export class ErinTreeRepository<E> extends Repository<E> {
  isTree() {
    return Reflect.getMetadata(
      TREE_KEY,
      (this.metadata.target as Function)["prototype"]
    );
  }

  save<T extends DeepPartial<E>>(
    entities: T[],
    options: SaveOptions & { reload: false }
  ): Promise<T[]>;
  save<T extends DeepPartial<E>>(
    entities: T[],
    options?: SaveOptions
  ): Promise<(T & E)[]>;
  save<T extends DeepPartial<E>>(
    entity: T,
    options: SaveOptions & { reload: false }
  ): Promise<T>;
  save<T extends DeepPartial<E>>(
    entity: T,
    options?: SaveOptions
  ): Promise<T & E>;
  async save<T extends DeepPartial<E>>(
    entity: T | Array<T>,
    options?: SaveOptions
  ): Promise<T[] | (T & E)[] | Promise<T> | Promise<T & E>> {
    if (!this.isTree()) {
      return Array.isArray(entity)
        ? super.save(entity, options)
        : super.save(entity, options);
    }
    const modelOptions = this.getTreeModelOptions();

    const id = entity.hasOwnProperty("id") ? entity : null;
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
        let parent: any = key === undefined ? undefined : entity[key as keyof typeof entity];

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
            throw new Error("Parent not registered");
          }
          node.parent = ownParent;
        }

        await this.manager.save(node);
        return newData;
      })
    );

    return data;
  }

  findMetadata() {
    return this.getMetadataKey();
  }

  async findRoot(options: FindTreeOptions) {
    let data = await this.manager
      .getTreeRepository(this.getTreeModel())
      .findRoots(options);
    return this.getNodesData(data);
  }

  async findParent(options?: FindManyOptions<E>): Promise<E[]> {
    if (!this.isTree()) {
      throw new Error("Model does not have tree property");
    }
    const modelOptions = this.getTreeModelOptions();

    let entities = await this.find(options);

    entities = await Promise.all(
      entities.map(async (entity: any) => {
        let node: any = await this.getTreeModelRepository()
          .createQueryBuilder()
          .setFindOptions({
            where: {
              [modelOptions.idColumn]: entity.id,
              [modelOptions.typeColumn]: entity.constructor.name,
            },
          })
          .getOne();

        if (node == undefined) {
          throw new Error("One or Many entities does not have record in Tree");
        }

        let parent = await this.manager
          .getTreeRepository(this.getTreeModel())
          .findAncestorsTree(node);

        entity.parent = await this.getNodesData(parent.parent, "parent");

        return entity;
      })
    );

    return entities;
  }

  async findChildren(options?: FindManyOptions<E>): Promise<E[]> {
    if (!this.isTree()) {
      throw new Error("Model does not have tree property");
    }
    const modelOptions = this.getTreeModelOptions();

    let entities = await this.find(options);

    entities = await Promise.all(
      entities.map(async (entity: any) => {
        let node: any = await this.getTreeModelRepository()
          .createQueryBuilder()
          .setFindOptions({
            where: {
              [modelOptions.idColumn]: entity.id,
              [modelOptions.typeColumn]: entity.constructor.name,
            },
          }).getOne();

        if (node == undefined) {
          throw new Error("One or Many entities does not have record in Tree");
        }

        let children = await this.manager
          .getTreeRepository(this.getTreeModel())
          .findDescendantsTree(node);
        entity.child = await this.getNodesData(children.child, "child");

        return entity;
      })
    );

    return entities;
  }

  async findSiblings(options: FindManyOptions){
    if (!this.isTree()) {
      throw new Error('Model does not have tree property');
    }
    const modelOptions = this.getTreeModelOptions();

    let entities = await this.find(options);
    entities = await Promise.all(
      entities.map(async (entity: any)=>{

        let node: any = await this.getTreeModelRepository()
          .createQueryBuilder()
          .setFindOptions({
            where: {
              [modelOptions.idColumn]: entity.id,
              [modelOptions.typeColumn]: entity.constructor.name,
            },
          })
          .getOne();

        if (node == undefined) {
          throw new Error('One or Many entities does not have record in Tree');
        }

        let parents = await this.manager
        .getTreeRepository(this.getTreeModel())
        .findAncestorsTree(node);

        let siblings = await this.manager.getTreeRepository(this.getTreeModel())
          .findDescendantsTree(parents.parent)

        entity.siblings = await this.getNodesData(siblings.child)
        return entity;
      })
    )

    return entities
  }

  /**
   * Recursive function
   * @param nodes nodes with tree
   * @param direction what would you want to find? parent? child?
   * @returns ObjectLiteral
   */
  private async getNodesData(
    nodes: ObjectLiteral | ObjectLiteral[],
    direction: "parent" | "child" | null = null
  ) {
    if (Array.isArray(nodes)) {
      return Promise.all(
        nodes.map(async (node) => {
          let data = await this.getNodeData(node);
          if(direction != undefined){
            data[direction] = await this.getNodesData(node[direction], direction);
          }
          return data;
        })
      );
    } else {
      if (nodes != undefined && nodes[direction] != undefined) {
        let data = await this.getNodeData(nodes);
        data[direction] = await this.getNodesData(nodes[direction], direction);
        return data;
      }
      return nodes != undefined ? this.getNodeData(nodes) : null;
    }
  }

  private async getNodeData(node: ObjectLiteral) {
    const modelOptions = this.getTreeModelOptions();
    return this.manager.getRepository(node.node_type).findOneBy({
      id: node[modelOptions.idColumn],
    });
  }

  private getMetadataKey() {
    return Reflect.getMetadataKeys(
      (this.metadata.target as Function)["prototype"]
    );
  }

  private findParentKey() {
    let target = (this.metadata.target as Function)["prototype"];
    return Reflect.getMetadataKeys(target).filter((value) => {
      let metadatas = value.split(TREE_KEY_SEPARATOR);
      if (metadatas.length == 2) {
        let metadata = Reflect.getMetadata(value, target);
        if (metadata.type == "parent") {
          return true;
        }
        return false;
      } else {
        return false;
      }
    });
  }

  private getPropertyFromTreeMetadataKey(key: String) {
    let data = key.split(TREE_KEY_SEPARATOR);
    return data.length == 2 ? data[1] : undefined;
  }

  private getTreeMetadata(key: string) {
    return Reflect.getMetadata(
      key,
      (this.metadata.target as Function)["prototype"]
    );
  }

  private getTreeModelRepository() {
    const target = this.metadata.target as Function;
    let data = Reflect.getMetadata(`${TREE_KEY}::TABLE`, target) as Function;
    return this.manager.getRepository(data());
  }

  private getTreeModel() {
    const target = this.metadata.target as Function;
    let data = Reflect.getMetadata(`${TREE_KEY}::TABLE`, target) as Function;
    return data();
  }

  private getTreeModelOptions(): ITreeModelOptions {
    const target = this.metadata.target as Function;
    return Reflect.getMetadata(`${TREE_KEY}::OPTIONS`, target);
  }

  private insertToTree() {}
}
