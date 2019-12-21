
const mongoclient = require('mongodb').MongoClient;

const zworm = require('../lib/zworm');
const Q = require('../lib/zwormquery');


class TestUser extends zworm
{

}
class test
{
    constructor()
    { 
        this.start();
    }
    async start()
    {
        this.testxx();
 
        this._db = await mongoclient.connect( dburl ,{ connectTimeoutMS:10000,useNewUrlParser:true}).then( (client) =>{
            return new Promise( ( resolve,reject ) => { resolve( client.db( 'wymgr' ) ) } );
        });
        return  this.testxx();
    }

    
    async testxx()
    {
        let obj = new TestUser( this._db );
        //if( userid >= 1 && userid < 10 && userid != 5 || userid == 100 )
        obj.userid = Q.Query('>=',1).and('<',10).and('!=',5).or('==',100);

        //if( xxx ||  (usertype != 3 && usertype != 5 && usertype != 10 || usertype == 0 ) )
        obj.usertype = Q.OrQuery('!=',3).and('!=',5).and('!=',10).or('==',0);

        //最终查询就是:
        //if( ( userid >= 1 && userid < 10 && userid != 5 || userid == 100 ) ||
        //(usertype != 3 && usertype != 5 && usertype != 10 || usertype == 0 )
        //)

    }
   
}

let vv = new test();
