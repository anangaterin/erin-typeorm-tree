import { Column, Entity, PrimaryGeneratedColumn, Tree as Type, TreeChildren, TreeParent } from "typeorm";

@Entity()
@Type('materialized-path')
export class Tree{

    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    node_type: string;

    @Column({
        type: "uuid"
    })
    node_id: string;

    @TreeParent()
    parent: Tree

    @TreeChildren()
    child: Tree[]

    type: string = this.constructor.name

}