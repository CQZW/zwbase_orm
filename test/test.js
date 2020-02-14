
const mongoclient = require('mongodb').MongoClient;
const   ObjectID    = require('mongodb').ObjectID;

const zworm = require('../lib/zworm');
const Q = require('../lib/zwormquery');

//收货地址
class TestAddress extends zworm
{
    mId;
    mUserId;
    mAddressStr;
    mPhone;
    constructor( db )
    {
        super(db);
        this.lockProps();
    }
    getPropIdName()
    {
        return 'mId';
    }
    propMapField( propname )
    {// mUserName => username
        if( propname == this.getPropIdName() ) return this.getFieldIdName();
        return propname.substring(1).toLowerCase();
    }
    fieldMapProp( fieldname )
    {//username => mUserName
        if( fieldname == this.getFieldIdName( ) ) return this.getPropIdName();
        let t = this.getAllWillMapProps();
        for(let one of t )
        {
            if( this.propMapField( one ) == fieldname ) return one;
        }
        return fieldname;
    } 

}
//用户订单
class TestOrder extends zworm
{
    
    mId;
    mUserId;
    mMoney = 0.0;
    mTime;
    mStatus = 0 ;
    constructor( db )
    {
        super(db);
        this.lockProps();

    }
    getPropIdName()
    {
        return 'mId';
    }
    propMapField( propname )
    {// mUserName => username
        if( propname == this.getPropIdName() ) return this.getFieldIdName();
        return propname.substring(1).toLowerCase();
    }
    fieldMapProp( fieldname )
    {//username => mUserName
        if( fieldname == this.getFieldIdName( ) ) return this.getPropIdName();
        let t = this.getAllWillMapProps();
        for(let one of t )
        {
            if( this.propMapField( one ) == fieldname ) return one;
        }
        return fieldname;
    } 
}
//用户
class TestUser extends zworm
{
    //假设定义一个规则:
    //定义属性,属性命名规则是 m + 首字母大写,然后驼峰法
    //表字段,将首字母m去除,全部小写

    mUserId         // ==> userid
    mUserName = ''  // ==> username
    mUserHeadURL = '' // ==> userheadurl
    mUserAge = 0;
    constructor( db )
    {
        super( db );
        //构造之后马上锁定要入库的字段,
        this.lockProps();
    }

    getPropIdName()
    {
        return 'mUserId';
    }
    propMapField( propname )
    {// mUserName => username
        if( propname == this.getPropIdName() ) return this.getFieldIdName();
        return propname.substring(1).toLowerCase();
    }
    fieldMapProp( fieldname )
    {//username => mUserName
        if( fieldname == this.getFieldIdName( ) ) return this.getPropIdName();
        let t = this.getAllWillMapProps();
        for(let one of t )
        {
            if( this.propMapField( one ) == fieldname ) return one;
        }
        return fieldname;
    }

}

class test
{
    constructor()
    { 
        this.start();
    }
    async start()
    {

        let dburl = 'mongodb://testtest:123456@127.0.0.1:27017/test';

        this._db = await mongoclient.connect( dburl ,{  connectTimeoutMS:10000,useNewUrlParser:true}).then( (client) =>{
            return new Promise( ( resolve,reject ) => { resolve( client.db( 'test' ) ) } );
        });
        return  this.testxx();
    }
    
    async testxx()
    { 
        /*
        let one = new TestUser(this._db);
        one.mUserName = 'zw';
        one.mUserHeadURL = 'http://xx.com/12/head.jpg';
        await one.insertThis();
        console.log( one.mUserId.toHexString() );
        
        one.mUserName = Q.Or_Query('|',['a','zw']);        
        //let obj = await one.select( 'mUserId','mUserHeadURL' ).sortBy('mUserId',true).findOne();
        let obj = await one.select( 'mUserId','mUserHeadURL' ).sortBy('mUserName','desc','mUserId','desc').findOne();
        console.log( obj.mUserId.toHexString() );
*/
        
        //let newobj = new TestUser( this._db );
        //newobj.mUserId = Q.Query('!=','5e0300d0bcbd212f467ac24d').and('!=',0);
        //await newobj.select( 'mUserId','mUserHeadURL' ).sortBy('mUserId',false).fetchThis();
        //console.log( newobj.mUserId.toHexString() );
        //let c = await newobj.select( 'mUserId','mUserHeadURL' ).sortBy('mUserId',false).count();
        //console.log('c:',c);

        // let delobj = new TestUser( this._db );
        // delobj.mUserId = Q.Query('!=',0);
        // let c = await delobj.deleteAll();
        // console.log('c:',c);
/*
        let a = new TestUser( this._db );
        a.mUserId = Q.Query('!=',1);
        a.mUserName = Q.Or_Query('!=','zw');

        let b = new TestUser( this._db );
        b.mUserId = Q.Query('!=',2);
        b.mUserName = Q.Query('!=','zww');

        let c = new TestUser( this._db );
        c.mUserId = Q.Query('!=',3);
        c.mUserName = Q.Or_Query('!=','qqqq');

        await a.or( b.and(c) ).fetchThis();

        console.log( 'url:',a.mUserId.toHexString() );*/

        // let address = new  TestAddress( this._db );
        // address.mUserId = ObjectID.createFromHexString('5e0566f8e67bb654ad76a566');
        // address.mPhone = '1111';
        // address.mAddressStr = 'cq here 222';

        // address.insertThis();
        // return;

        let order = new TestOrder( this._db );
        //order.mUserId =  ObjectID.createFromHexString('5e0566f8e67bb654ad76a566');
        //await order.insertThis();
        order.mStatus = Q.Query('==',0);
        order.sortBy( 'mId' ,false );

        let addr = new TestAddress( this._db );
 
        addr.mPhone = Q.Query('!=','15800000');

        let testjoin = new TestUser( this._db );
        testjoin.mUserName = Q.Query('==','xxxx');
        testjoin.sortBy('mUserId',true);
        //await testjoin.leftJoin( TestOrder,'mUserId','mUserId','mOrders').fetchThis();
        testjoin.leftJoin( order,'mUserId','mUserId','mOrders',true);
        testjoin.leftJoin( addr,'mUserId','mUserId','mAddress',true);
        await testjoin.fetchThis();
        console.log( ' orderid:',testjoin );

/*
        let testup = new TestUser( this._db );
        testup.mUserName = Q.Query('==','zzzaaa');
        let c = await testup.updateThis( testup.makeop( 'mUserAge','+',100 ) );
        console.log('c:',c);
 */
    }
   
}
 
let vv = new test();
