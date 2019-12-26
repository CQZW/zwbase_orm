
const mongoclient = require('mongodb').MongoClient;
const   ObjectID    = require('mongodb').ObjectID;

const zworm = require('../lib/zworm');
const Q = require('../lib/zwormquery');


class TestUser extends zworm
{
    //假设定义一个规则:
    //定义属性,属性命名规则是 m + 首字母大写,然后驼峰法
    //表字段,将首字母m去除,全部小写

    mUserName = '';
    mUserId = undefined;
    mUserHeadURL = '';

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
        let t = this.getLockedProps();
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
        
        let one = new TestUser(this._db);
        one.mUserName = 'zw';
        one.mUserHeadURL = 'http://xx.com/12/head.jpg';
        //await one.insertThis();
        //console.log( one.mUserId.toHexString() );
        
        one.mUserName = Q.Query('!=','zw').or('==','www');
        one.mUserId = Q.Query('!=','5e0300d0bcbd212f467ac24d' ).and('!=',0);
        
        //let obj = await one.select( ['mUserId','mUserHeadURL'] ).sortBy('mUserId',true).findOne();
        //console.log( obj.mUserId.toHexString() );

        
        let newobj = new TestUser( this._db );
        newobj.mUserId = Q.Query('!=',0);
        newobj.mUserName = Q.Query('==','zw');
        //await newobj.select( ['mUserId','mUserHeadURL'] ).sortBy('mUserId',false).fetchThis();
        //console.log( newobj.mUserId.toHexString() );
        let c = await newobj.select( ['mUserId','mUserHeadURL'] ).sortBy('mUserId',false).count();
        console.log('c:',c);
        
    }
   
}
 
let vv = new test();
