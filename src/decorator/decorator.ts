import { TREE_KEY, TREE_KEY_SEPARATOR } from "../constant/constant";
import "reflect-metadata";
import { ITreeModelOptions } from "../interfaces/tree_interfaces";

/**
 * Property decorator to be assigned to parent object from a model
 * @returns 
 */
export const Parent = (): PropertyDecorator => (target, key: string) => {
  Reflect.defineMetadata(TREE_KEY, true, target);
  Reflect.defineMetadata(
    `${TREE_KEY}${TREE_KEY_SEPARATOR}${key}`,
    {
      type: "parent",
      node: Reflect.getMetadata("design:type", target, key),
    },
    target
  );
};

/**
 * Property decorator to be assigned to a child object from a model
 * @returns 
 */
export const Children = (): PropertyDecorator => (target, key: string) => {
  Reflect.defineMetadata(TREE_KEY, true, target);
  Reflect.defineMetadata(
    `${TREE_KEY}${TREE_KEY_SEPARATOR}${key}`,
    {
      type: "children",
    },
    target
  );
};


/**
 * Class decorator assigned to a model that will implement poly tree
 * @param model A model that implement TypeORM's materialized-path tree
 * @param options A tree model's column that stored entity type and id
 * @returns 
 */
export const ErinTree =
  (
    model: Function,
    options: ITreeModelOptions = {
      typeColumn: "node_type",
      idColumn: "node_id",
    }
  ): ClassDecorator =>
  (target) => {
    Reflect.defineMetadata(`${TREE_KEY}::TABLE`, model, target);
    Reflect.defineMetadata(`${TREE_KEY}::OPTIONS`, options, target);
  };
