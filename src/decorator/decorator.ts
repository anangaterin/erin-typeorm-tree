import { TREE_KEY, TREE_KEY_SEPARATOR } from "../constant/constant"
import "reflect-metadata";

export const Parent = (): PropertyDecorator => (target, key: string) => {
    Reflect.defineMetadata(TREE_KEY, true, target)
    Reflect.defineMetadata(`${TREE_KEY}${TREE_KEY_SEPARATOR}${key}`,
        {
            type: 'parent',
            node: Reflect.getMetadata("design:type", target, key)
        }, 
        target
    )
}

export const Children = (): PropertyDecorator => (target, key: string) =>{
    Reflect.defineMetadata(TREE_KEY, true, target)
    Reflect.defineMetadata(`${TREE_KEY}${TREE_KEY_SEPARATOR}${key}`,
    {
        type: 'children'
    }, 
    target
)
}