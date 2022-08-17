## Erin TypeORM Tree
This library is used to create a tree with different data type as shown below

```
       [Site]
       /    \
[Building] [Amenity]
    |         |
  [...]     [...]
```

## How it work?
This library will require a table that store the node data. This table will implement [TypeORM](https://typeorm.io/tree-entities)'s materialized-path tree. Each node will have node_type and node_id properties that will search specific record in corresponding table using the node_id and node_type.

## How to use
This example are for [Nest.js](https://nestjs.com/)  

### Setup
Create a table that use [TypeORM](https://typeorm.io/tree-entities)'s materialized-path  
```typescript
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
}
```

Create your model and add class decorator `@ErinTree()` with parameters of a function that returns a class of your previusly created table. The second parameters was an object that have typeColumn and idColumn properties. It is optional you can leave them empty.  
  
  Parent and Children property will have any type as it can be anything. Each will have property decorator of `@Parent()` and `@Children()` respectively. Remember to use `@Parent()` that imported from this lib beacuse TypeORM have similar decorator.  

  Parent and Childern property are not required. For example your root may only use Childern and your leaf may only require Parent. If you don't know or not sure, it is better to have both.
```typescript
import { Children, ErinTree, Parent } from "erin-typeorm-tree";
import { Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import { Tree } from "./tree.entity";

@Entity()
@ErinTree(()=> Tree, {
    typeColumn: 'node_type' // default, or change it to your column that stores the data Type
    idColumn: 'node_id' // default, ot change it to your colum that stores the data Id
})
export class Building{
    @PrimaryGeneratedColumn("uuid")
    id: string

    @Column()
    name: string

    @Children()
    children: any[]
    
    @Parent()
    parent: any

    type: string = this.constructor.name

}
```

Create your repository that extends `ErinTreeRepository`
```typescript
@Injectable()
export class BuildingRepository extends ErinTreeRepository<Building>{
    constructor(private dataSource: DataSource)
    {
        super(Building, dataSource.createEntityManager());
    }
}
```

Import your repository in your module
```typescript
@Module({
    imports:[],
    controllers:[BuildingController],
    providers: [BuildingProvider, BuildingRepository]
})
export class BuildingModule{}
```

Inject your repository to your provider
```typescript
@Injectable()
export class BuildingProvider {
  constructor(
    private readonly buildingRepository: BuildingRepository,
    @InjectRepository(Site)
    private readonly siteRepository: Repository<Site>,
  ) {}
}
```


### Insert Data
```typescript
  async insert(building: CreateBuildingDTO): Promise<Building> {
    const { name, siteId } = building;


    let site = await this.siteRepository.findOneBy({
      id: Equal(siteId)
    })
    let newBuilding = new Building();
    newBuilding.name = name;
    newBuilding.parent = site;

    return this.buildingRepository.save(newBuilding);
  }
```

### Get Parents
```typescript
 async get(data: GetBuildingDTO){
    let building =  await this.buildingRepository.findParent({where:{
      id: data.id
    }})
    return building
  }

// returns array
[
    {
        "type": "Building",
        "id": "8e4611dc-3c0c-4954-a52f-7d586417709c",
        "name": "Building Dietrich",
        "parent": {
            "type": "Site",
            "id": "7738d677-cdbd-461c-b4dd-53ef8f0a77ca",
            "name": "Donnelly Group",
            "address": "8782 Ashlee Street"
        }
    }
]

```

### Get Children
```typescript
async get(data: GetBuildingDTO){
    let building =  await this.buildingRepository.findChildren({where:{
      id: data.id
    }})
    return building
}

// returns array
[
    {
        "type": "Building",
        "id": "8e4611dc-3c0c-4954-a52f-7d586417709c",
        "name": "Building Dietrich",
        "child": [
            {
                "type": "Floor",
                "id": "8edd2a94-eb29-494f-9dbd-b4a4439a6fc1",
                "number": 35,
                "child": [
                    {
                        "type": "Lot",
                        "id": "8fb584e3-ab9c-4030-be5e-06bea64d6eca",
                        "number": "55",
                        "child": []
                    }
                ]
            }
        ]
    }
]
```

### Find Siblings
```typescript
  async get(data: GetBuildingDTO){
    let building =  await this.buildingRepository.findSiblings({where:{
      id: data.id
    }})
    return building
  }

  // returns array
  [
    {
        "type": "Building",
        "id": "ddc016c8-ec5c-479b-9e48-4178c44bea00",
        "name": "Building Schuppe",
        "siblings": [
            {
                "type": "Building",
                "id": "8e4611dc-3c0c-4954-a52f-7d586417709c",
                "name": "Building Dietrich"
            },
            {
                "type": "Amenity",
                "id": "1f19e8a4-c5db-4416-8518-52afb9ac2195",
                "name": "Willms Room"
            },
            {
                "type": "Building",
                "id": "658b602f-1bed-4fe5-8bf2-3b22c74b66a5",
                "name": "Building Pacocha"
            },
            {
                "type": "Building",
                "id": "ddc016c8-ec5c-479b-9e48-4178c44bea00",
                "name": "Building Schuppe"
            }
        ]
    }
]
```

## What's next?
This library is not completed yet. The most obvious thing is we still need to implement update and delete, like parent deleting child or child change parent.  
### TO DO : 
- [ ] Implement Update
- [ ] Implement Delete