# zwbase_orm--mangodb的一个ORM实现
### 1.ZWORM-提供表名,字段名映射,增删改查,索引创建
    ZWORM属性的值分 普通值和查询值,查询值就是zwormquery的实例
    //通常可以定义一个基础的ORM,处理统一的映射规则,这里假设:mUserName => userName;
    class TestBase extends ZWORM
    {
        propMapField( )
        {
            //属性->数据库字段名
        }
        fieldMapProp( )
        {
            //数据库字段名->属性名
        }
    }
    class TestUser extends TestBase
    {
        mIncId;//自增ID
        mUserId;
        mUserName = '';
        mUserAge = 18;
        //自增字段,插入数据会自动增长
        getAutoIncProp()
        {
            return 'mIncId';
        }
        //主键字段
        getPropIdName()
        {
            return 'mUserId';
        }
        indexInfo()
        {
            //创建一个索引,名字是 age_index ,字段是 mUserAge,不是唯一索引
            return [ this.tempIndex( 'age_index',['mUserAge'],false ) ];
        }
    }
    class TestOrder extends TestBase
    {
        mId;
        mWho;
        mMoney = 0.0;
        mTime;
        mStatus = 0;
    }

    //查询语句类型
    const Q = require('../lib/zwormquery');

    //插入数据
    let user = new TestUser( db  );
    user.mUserName = 'zw';
    await user.insertThis();

    //插入/更新,如果没有就插入,如果有就根据主键ID更新数据
    let user = new TestUser( db  );
    user.mUserId = '5e0dbd720f9818a0ca0c0748';
    user.mUserName = 'zw';
    await user.dumpThisById();
    
    //更新数据,根据mUserId 更新 mUserName
    let user = new TestUser( db  );
    user.mUserId = Q.Query('==','5e0dbd720f9818a0ca0c0748' );
    user.mUserName = 'zzzwww';
    await user.updateThis();
    //或者原生更新语句
    await user.updateThis( {'$set':{'userName':'zzzwww'}} );
    //类似的还有 updateAtom 原子更新,updateMany 多条更新

    //查询数据
    let user = new TestUser( db  );
    user.mUserId = Q.Query('==','5e0dbd720f9818a0ca0c0748' );
    await user.findOne();//返回一个新的TestUser对象
    //或者
    await user.fetchThis();//不返回新的数据,填充user对象

    //多页查询
    //查询 userAge 字段 >= 18的数据,(mUserAge 属性名在数据库映射为 userAge 字段 )
    let user = new TestUser( db  );
    user.mUserAge  = Q.Query('>=',18);
    let list = await = user.find(0,20);//查询第0页,每页20条数据

    //查询排序
    let user = new TestUser( db  );
    user.mUserAge  = Q.Query('>=',18);
    user.sortBy( 'mUserAge',true );//userAge 字段升学排列
    let list = await = user.find();

    //选择返回字段
    let user = new TestUser( db  );
    user.mUserAge  = Q.Query('!=',18);
    user.select( 'mUserAge','mUserId');//只返回这2个字段,其他不好包含
    await user.findOne();

    //删除数据
    let user = new TestUser( db  );
    user.mUserAge = Q.Query('<',18);
    await user.removeThis();

    //创建索引,见 indexInfo 方法

***
### 2.zwormquery-查询值封装类
    用于封装属性值的查询语句,当ZWORM对象的某个属性值是 zwormquery ,就表明该属性值作为查询

    //属性值之间 and 关系,
    let user = new TestUser( db  );
    user.mUserAge = Q.Query('==',18);
    user.mUserName = Q.Query('==','zw');
    await user.findOne();//查询userAge == 18 && userName == 'zw' 的数据

    //or 关系,
    let user = new TestUser( db  );
    user.mUserAge = Q.Query('==',18);
    user.mUserName = Q.Or_Query('==','zw');
    await user.findOne();//查询 userAge == 18 || userName == 'zw' 的数据

    //更多复合查询,
    let q1 = new TestUser( db  );
    q1.mUserAge = Q.Query('>',18);
    q1.mUserName = Q.Query('==','zw');
    
    let q2 = new TestUser( db  );
    q2.mUserAge = Q.Query('<',10);
    q2.mUserName = Q.Query('!=','abcd');
    //查询 (userAge > 18 && userName == 'zw') || (userAge < 10 && userName != 'abcd')
    q1.or( q2 ).findOne();

    //原生语句
    let user = new TestUser(db);
    user.mUserAge = Q.Org_Query( { userAge:{'$gt':18} } );//查询userAge>18的数据

    //更多查询语句支持 见 _appendq 方法

***
### 3.联合查询
    let user = new TestUser(db);
    user.mUserName = Q.Query('==','zw');
    let order = new TestOrder(db);
    order.mMoney = Q.Query('>',20);
    user.leftJoin( order,'mWho','mUserId','mOrders',false);
    //查询 userName == 'zw' 的用户,并且查询他的订单数据返回到 mOrders字段,并且只返回 money > 20的订单
    await user.fetchThis();

这里还有一个基于express的分布式服务器框架 [zwbase](https://www.npmjs.com/package/zwbase)


