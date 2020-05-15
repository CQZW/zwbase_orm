
const mongoclient = require('mongodb').MongoClient;
const   ObjectID    = require('mongodb').ObjectID;

const zworm = require('../lib/zworm');
const Q = require('../lib/zwormquery');

class TestBase extends zworm
{
    mBaseid ='';
    constructor(db)
    {
        super(db);
        this.lockProps();
    }
    getSearchClsStartAt( clsname )
    {
        return module
    }
}

//收货地址
class TestAddress extends TestBase
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
class TestOrder extends TestBase
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
class TestUser extends TestBase
{
    //假设定义一个规则:
    //定义属性,属性命名规则是 m + 首字母大写,然后驼峰法
    //表字段,将首字母m去除,全部小写

    mIncId;//自增ID
    mUserId         // ==> userid
    mUserName = ''  // ==> username
    mUserHeadURL = '' // ==> userheadurl
    mUserAge = 0;
    mOpenId;
    mType;
    mToken;
    mTestDate;
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
    getAutoIncProp()
    {
        return 'mIncId';
    }
    indexInfo()
    {
        let a = super.indexInfo();
        let openid_index = this.tempIndex( 'openid_index', [ 'mOpenId' ] ,true );
        a.push(openid_index);
        let ttl_index = this.tempIndex('ttl_index',['mTestDate'],false);
        ttl_index.opt.expireAfterSeconds = 0;
        a.push( ttl_index );
        return a;
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
        await this.testunit();
        return  this.testxx();
    }
    
    async testunit()
    {
        let user = new TestUser( this._db );
        await user.deleteAll();

        let delorders = new TestOrder( this._db );
        await delorders.deleteAll();

        let _uniq_val = TestUser.createId() + '_zw';
        user.clearValues();
        user.mUserAge = 10;
        user.mUserName = _uniq_val;
        let retv = await user.insertThis();
        if( retv != 1 || user.mIncId ==  0 ) console.error('unpass insertThis');
        else console.log('test insertThis ok');

        let user_forq = new TestUser( this._db );
        user_forq.mUserName = Q.Query('==', _uniq_val );
        await user_forq.fetchThis();
        if( user_forq.mUserName != _uniq_val ) console.error('unpass fetchThis');
        else console.log('test fetchThis ok');

        user_forq.clearValues();
        user_forq.mUserName = Q.Query( '==', _uniq_val );
        user_forq = await user_forq.findOne();
        if( user_forq.mUserName != _uniq_val) console.error('unpass findOne');
        else console.log('test findOne ok');        

        user_forq.clearValues();
        user_forq.mUserName = Q.Query('==',_uniq_val);
        user_forq.mUserAge = 20;
        await user_forq.updateThis();

        user_forq.clearValues();
        user_forq.mUserName = Q.Query('==', _uniq_val );
        await user_forq.fetchThis();
        if( user_forq.mUserAge != 20 ) console.error('unpass updateThis');
        else console.log('test updateThis ok');

        user_forq.clearValues();
        user_forq.mUserName = Q.Query('==', _uniq_val );
        let retcur = user_forq.findRetCursor();
        if( !retcur || !await retcur.hasNext() ) console.error('unpass findRetCursor');
        let _tmp = await user_forq.nextObj( retcur );
        if( !_tmp || _tmp.mUserName != _uniq_val ) console.error('unpass findRetCursor');
        else console.log('test findRetCursor ok');

        user_forq.clearValues();
        user_forq.select( 'mUserName' );
        user_forq.mUserName = Q.Query('==', _uniq_val );
        await user_forq.fetchThis();
        if( user_forq.mUserName == undefined || user_forq.mUserAge != undefined ) console.error('unpass select');
        else console.log('test select ok');

        user_forq.clearValues();
        let _objid = TestUser.createId(false);
        user_forq[ user_forq.getPropIdName() ] = _objid;
        user_forq.mUserAge = 11;
        user_forq.mUserName = _uniq_val +  'dump';
        user_forq.mIncId = 1111;
        retv = await user_forq.dumpThisById( [ 'mUserAge', 'mUserName','mIncId'] );
        if( retv != 1 ) console.error('unpass dumpThisById');
        user_forq.clearValues();
        user_forq[ user_forq.getPropIdName() ] = Q.Query('==',_objid);
        await user_forq.fetchThis();
        if( user_forq.mUserAge != 11 || user_forq.mUserName != (_uniq_val +  'dump') || user_forq.mIncId == 1111 ) console.error('unpass dumpThisById');

        user_forq.clearValues();
        user_forq[ user_forq.getPropIdName() ] = _objid;
        user_forq.mUserAge = 22;
        user_forq.mUserName = _uniq_val +  'dump_update';
        user_forq.mIncId = 3333;
        retv = await user_forq.dumpThisById( [ 'mUserAge', 'mUserName'] );
        if( retv != 0 ) console.error('unpass dumpThisById');
        user_forq.clearValues();
        user_forq[ user_forq.getPropIdName() ] = Q.Query('==',_objid);
        await user_forq.fetchThis();
        if( user_forq.mUserAge != 22 || user_forq.mUserName != (_uniq_val +  'dump_update') || user_forq.mIncId == 3333 ) console.error('unpass dumpThisById');
        else console.log('test dumpThisById ok');

        user_forq.clearValues();
        user_forq.sortBy( 'mUserAge',false );
        let arr = await user_forq.find();
        if( arr[0].mUserAge != 22 ) console.error('unpass sortBy');
        else console.log('test sortBy ok');

        user_forq.clearValues();
        let _orgquery = {};
        _orgquery[ user_forq.getFieldNameByPropName('mUserName') ] = _uniq_val;
        user_forq.setOrgQuery(_orgquery);
        await user_forq.fetchThis();
        if( user_forq.mUserName != _uniq_val ) console.error('unpass setOrgQuery');
        else console.log('test setOrgQuery ok');

        user_forq.clearValues();
        user_forq.mUserAge = Q.Query('!=' ,0 );
        user_forq.mUserName = 'zw';
        retv = await user_forq.updateMany();
        if( retv == 0 )  console.error('unpass updateMany');
        user_forq.clearValues();
        user_forq.mUserName = Q.Query('==' , 'zw' );
        arr = await user_forq.find(0,retv);
        if( arr.length != retv ) console.error('unpass updateMany');
        else console.log('test updateMany ok');

        user_forq.clearValues();
        user_forq.mUserName = Q.Query( '==' , 'zw' );
        user_forq.mUserAge = 99;
        retv = await user_forq.updateAtom();
        if( retv != 1 ) console.error('unpass updateAtom');
        else console.log('test updateAtom ok');

        user.clearValues();
        user.mUserName = Q.Query('==','zw');

        user_forq.clearValues();
        user_forq.mUserAge = 1;
        user_forq.mUserName = _uniq_val;
        user_forq.mUserHeadURL = 'http://';
        retv = await user_forq.upInsert( user, [ 'mUserName', 'mUserHeadURL']  );
        if( retv != 0 ) console.error('unpass upInsert');
        
        user.clearValues();
        user.mUserName = Q.Query('==','zww');
        user_forq.clearValues();
        user_forq.mUserAge = 1;
        user_forq.mUserName = 'zww';
        user_forq.mUserHeadURL = 'http://';
        retv = await user_forq.upInsert( user, [ 'mUserName', 'mUserHeadURL']  );
        if( retv != 1 ) console.error('unpass upInsert');

        user_forq.clearValues();
        user_forq.mUserName = Q.Query('==','zww');
        await user_forq.fetchThis();
        if( user_forq.mUserName != 'zww' ) console.error('unpass upInsert');
        else console.log('test upInsert ok');
        
        if( user_forq.cutObj( ['mUserName'],1 ).mUserName != undefined ) console.error('unpass cutObj');
        retv = user_forq.cutObj( ['mUserName'],2 );
        if( Object.keys(retv).length != 1 ) console.error('unpass cutObj');
        else console.log('test cutObj ok');
        
        _objid =  user_forq.mUserId;
        let order = new TestOrder( this._db );
        order.mUserId  = _objid;
        order.mMoney = 10;
        order.mStatus = 1;
        order.mTime = new Date();
        await order.insertThis();

        let order1 = new TestOrder( this._db );
        order1.mUserId  = _objid;
        order1.mMoney = 20;
        order1.mStatus = 2;
        order1.mTime = new Date();
        await order1.insertThis();

        let forj_order = new TestOrder( this._db );
        forj_order.mMoney = Q.Query( '==' , 20 );
        let testjion = new TestUser( this._db );
        testjion.mUserId = Q.Query('==',_objid);
        testjion.leftJoin( forj_order, 'mUserId','mUserId','mOrders',false );
        await testjion.fetchThis();
        if( !Array.isArray( testjion.mOrders) ||  testjion.mOrders[0].mMoney != 20  )  console.error('unpass leftJoin');

        forj_order.mMoney = 20;
        testjion = new TestUser( this._db );
        testjion.mUserId = Q.Query('==',_objid);
        testjion.leftJoin( forj_order, 'mUserId','mUserId','mOrder',true );
        await testjion.fetchThis();
        if( testjion.mOrder == undefined ||  testjion.mOrder.mMoney != 20  )  console.error('unpass leftJoin');
        else console.log('test leftJoin ok');
        

        testjion.mTest = {};
        testjion.mTest.a = new TestOrder();
        testjion.mTest.a.mMoney = 20;
        testjion.getLockedProps(true);
        retv = testjion.enCodeForDump();
        retv = JSON.stringify( retv );
        testjion = new TestUser( );
        testjion.decodeFromDump( JSON.parse( retv ) );
        if(  !(testjion.mTest.a instanceof TestOrder) ||  testjion.mTest.a.mMoney != 20 ) console.error('unpass code/decode');
        else console.log('test code/decode ok');
        
        
        user.clearValues();
        user.mUserName = 'abc';
        user.mUserAge = 10;
        await user.insertThis();

        user.clearValues();
        user.mUserName = 'abc';
        user.mUserAge = 12;
        await user.insertThis();


        user.clearValues();
        user.mUserName = 'bbb';
        user.mUserAge = 30;
        await user.insertThis();

        user.clearValues();
        user.mUserName = 'ccc';
        user.mUserAge = 30;
        await user.insertThis();

        user_forq.clearValues();
        user_forq.mUserName = Q.Query( '==' , 'ccc' );
        user_forq.mUserAge = Q.Query( '==' , '20' );
        if( await user_forq.fetchThis() ) console.error('unpass 1 and query');

        user_forq.clearValues();
        user_forq.mUserName = Q.Query( '==' , 'ccc' ).or( '==','ddddd');
        if( !await user_forq.fetchThis() || user_forq.mUserAge != 30 ) console.error('unpass 1 or query');
        else  console.log('1 or query ok');

        user_forq.clearValues();
        user_forq.mUserName = Q.Query( '==' , 'ccc' );
        user_forq.mUserAge = Q.Or_Query( '==' , 12 );
        user_forq.sortBy('mUserAge',true);
        arr = await user_forq.find();
        if( arr[0].mUserAge != 12 || arr[1].mUserName != 'ccc'  ) console.error('unpass 2 or query');
        else console.log('2 or query ok');

        user.clearValues();
        user.mUserName = Q.Query('==', 'abc' );
        user.mUserAge = Q.Query('<',31);

        user_forq.clearValues();
        user_forq.mUserName = Q.Query('!=', 'ccc' );
        user_forq.mUserAge = Q.Query('>',10);
        await user_forq.and( user ).fetchThis();
        if( user_forq.mUserAge != 12 ) console.error('unpass 3 and query');
        else  console.log('3 and query ok');
        
        let oruser = new TestUser();
        oruser.mUserName = Q.Query('==','ccc');
        user_forq.sortBy('mUserAge',true);
        arr = await user_forq.or( oruser ).find();
        if( arr[0].mUserAge != 12 || arr[1].mUserName != 'ccc' ) console.error('unpass 4 mix query');
        else  console.log('4 mix query ok');

        user_forq.clearValues();
        user_forq.mUserName = Q.Query('like', 'bbb$' );
        await user_forq.fetchThis();
        if( user_forq.mUserAge != 30 ) console.error('unpass regex query'); 
        else console.log('test regex query ok');




        console.log('\nall test end\n');
        return Promise.resolve();
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


        /**
         * @type TestUser
         */
        let tuser = new TestUser( this._db );
        tuser.clearValues();
        tuser.mUserId = Q.Query('==','5e46b3f7f531b2737b48a940' );
        await tuser.fetchThis();
        console.log( tuser.cutObj( ['mUserAge'] ,2) );

        let order = new TestOrder( this._db );
        //order.mUserId =  ObjectID.createFromHexString('5e0566f8e67bb654ad76a566');
        //await order.insertThis();
        order.mStatus = Q.Query('==',0);
        order.sortBy( 'mId' ,false );

        let addr = new TestAddress( this._db );
 
        addr.mPhone = Q.Query('!=','15800000');

        let testjoin = new TestUser( this._db );
        testjoin.mOrders = {};//for test
        testjoin.mUserName = Q.Query('==','xxxx');
        testjoin.sortBy('mUserId',true);
        //await testjoin.leftJoin( TestOrder,'mUserId','mUserId','mOrders').fetchThis();
        testjoin.leftJoin( order,'mUserId','mUserId','mOrders',true);
        testjoin.leftJoin( addr,'mUserId','mUserId','mAddresses',true);
        await testjoin.fetchThis();
        console.log( ' orderid:', JSON.stringify( testjoin ) );

        let forudmp = testjoin.enCodeForDump();
        let fordecode_user = new TestUser( this._db );
        forudmp = JSON.stringify( forudmp );
        fordecode_user.decodeFromDump( JSON.parse( forudmp ) );
        let forindex = new TestUser( this._db );
        await forindex.installIndex();
 
        let tmpid = new ObjectID("5e46687c82ac3263981d165d");
        let testdump = new TestUser( this._db );
        testdump.mUserId = tmpid;
        testdump.mIncId = 1;
        testdump.mUserAge = 1;
        testdump.mUserName = 'zazaaa';
        testdump.mTestDate = new Date( new Date().getTime() + 1000*60 );
        //await testdump.dumpThisByUniq( );
        // //console.log( JSON.stringify (testdump.cutObj() ) );

        // let testatom = new TestUser( this._db );
        // testatom.mUserName = Q.Query('==','newname3');
        // let forup = new TestUser( this._db );
        // forup.mUserName = 'newname3';
        // forup.mUserAge = 111;
        // await testatom.updateAtom( forup );

        let tquery = new TestUser( this._db );
        tquery.mUserName = Q.Query('==','zzzbbba1111');
        
        let testupsert = new TestUser( this._db );
        testupsert.mUserHeadURL = 'http:xxxaaaccc';
        testupsert.mUserName = 'zzzbbba1111';
        await testupsert.upInsert( tquery,[ 'mUserHeadURL' ] );


 /*
        let testup = new TestUser( this._db );
        testup.mUserName = Q.Query('==','zzzaaa');
        let c = await testup.updateThis( testup.makeop( 'mUserAge','+',100 ) );
        console.log('c:',c);
 */
    }
   
}
 
let vv = new test();
let expmodel = {};
expmodel.TestAddress = TestAddress;
expmodel.TestOrder = TestOrder;
expmodel.TestUser = TestUser;
module.exports = expmodel;