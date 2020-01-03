/**
 * 对象和数据表之间的自动映射
 * 数据库操作封装,提取常用的方法
 * 添加操作增加 createat 字段
 * 更新操作增加 lastModified 字段
 * @class ZWORM
 */
const ZWQuery = require('./zwormquery');

class ZWORM
{
    //定义属性,并且设置默认值,不设置就是undefined
    //入库的数据,如果是undefined就不会入库
    //id
    //name = ''
    //phone= ''
    createat;
    lastModified;
    
    constructor( dbinst,tablename = null , saveop = null )
    {

        this._cls = Object.getPrototypeOf(this).constructor;

        this._dbinst = dbinst;

        this._saveop = saveop;
        if( saveop == null )
            this._saveop = { 'j':true,'w':1 };

        //如果不指定表名字,就是 t_ + 类名
        this._tableName = tablename;
        if( this._tableName == null )
            this._tableName = this._makeTableName();

        //查询返回的数据字段
        this._selectfields = null;
        
        //查询对象
        this._queryobj = null;

        //复杂的聚会查询
        this._aggregate = [];

        //复杂查询,结果和类型的映射
        this._aggmap = {};

        //排序规则
        this._sortby = null

        //锁定字段,通常用做入库字段的限制
        this._lockedprops = null;

        //连接产生的属性
        this._joinedpros = [];
    }

    /**
     * 清除数据,全部设置到undefined
     * 查询对象也会被清除
     * @memberof ZWORM
     */
    clearValues()
    {
        let arr = this.getLockedProps();
        for( let one of arr )
        {
            this[ one ] = undefined;
        }
        this.clearQuerys();
    }

    /**
     * 删除所有查询相关数据
     *
     * @memberof ZWORM
     */
    clearQuerys()
    {
        this._queryobj = null;

        this._aggregate = null;

        this._joinedpros = [];
    }

    /**
     * 锁定要写入数据库的字段,通常构造函数 super() 之后调用
     * 调用之后,数据库 字段和属性名字的映射及数量就确定了
     * 对象增加了属性也不会写入到数据库,要增加入库字段需要在顶部定义
     * @param {boolean} forcerelock 是否强制重新锁定所有字段
     * @memberof ZWORM
     */
    lockProps( forcerelock = false )
    {
        if( forcerelock ) this._lockedprops = null;
        if( this._lockedprops ) return;
        let t = Object.keys( this );
        let tt = new Array();
        for( let one of t )
        {
            if( one.indexOf('_') == 0 ) continue;
            tt.push( one );
        }
        this._lockedprops = tt;
    }

    /**
     * 获取当前锁定的属性
     * 通常用于表明 需要输入数据库的字段
     * @returns {[]}
     * @memberof ZWORM
     */
    getLockedProps()
    {
        let r = this._lockedprops;
        if( !r ) throw new Error('you do not lock fields');
        return r;
    }

    /**
     * 所有属性,包括jion的
     * 这些属性就是所有要参与映射到对象的字段
     * 表明这个对象到底要输出那些字段
     * @returns
     * @memberof ZWORM
     */
    getAllWillMapProps()
    {
        return this.getLockedProps().concat( this._joinedpros );
    }


    _makeTableName()
    {
        return ('t_' + this.constructor.name).toLowerCase();
    }

    /**
     * id 默认 映射到 _id 的规则
     * 
     * 可以继承修改行为
     * 将属性名映射到数据库的字段名字,默认和属性名称相同
     * @param {string} propname
     * @returns {string} field
     * @memberof ZWORM
     */
    propMapField( propname )
    {
        /*比如对象里面定义的字段名字有自己的规则,比如命名风格之类
        let obj = new XXX();
        obj.mId = 1;
        obj.mName = 2222;
        obj.mDescInfo = 3333;

        //数据库字段或许没有这种规则
        是这种 id ,name ,descinfo
        这时候就需要自己实现映射规则,将 mId 映射到 id,
        */
        if( propname == this.getPropIdName() ) propname = this.getFieldIdName();
        return propname;
    }

    /**
     * _id 默认 映射到 id 的规则
     * 可以继承修改行为
     * 数据库字段映射到对象里面的属性
     *
     * @param {*} fieldname
     * @returns {string} propname
     * @memberof ZWORM
     */
    fieldMapProp( fieldname )
    {
        if( fieldname == this.getFieldIdName() ) fieldname = this.getPropIdName();
        return fieldname;
    }

    /**
     * 获取id字段名字 对应 _id 
     * 可以理解为主键吧
     * @returns
     * @memberof ZWORM
     */
    getPropIdName()
    {
        return 'id';
    }

    /**
     * 获取数据库id字段名字
     *
     * @returns
     * @memberof ZWORM
     */
    getFieldIdName()
    {
        return '_id';
    }

    /**
     * 将自己映射为数据存储的对象
     * 
     * @returns
     * @memberof ZWORM
     */
    mapToRow()
    {
        let keys = this.getLockedProps();
        let dumpobj = {};
        for( let key of keys )
        {
            // _ 开头的字段都不要
            if( key.indexOf('_') == 0 ) continue;
            let v = this[ key ];
            if( v == undefined ) continue;
            dumpobj[ this.propMapField(key) ] = v;
        }
        return dumpobj;
    }
    /**
     * 将数据库一行数据,映射为一个自己类型的对象
     * 数据库->对象,允许多出些字段,所以这里没有考虑 循环 lockedprops 
     * @param {*} row
     * @returns {ZWORM} 返回新的一个同类型的对象
     * @memberof ZWORM
     */
    mapToObj( row )
    {
        let keys = Object.keys( row );
        let obj = new this._cls();
        for( let key of keys )
        {
            let p = this.fieldMapProp(key);
            let v = row[ key ];
            let _mapedobj = null;
            if( this._aggmap && (_mapedobj = this._aggmap[ p ]) )
            {
                if( v instanceof Array )
                {
                    let ta = [];
                    for( let onesub of v )
                    {
                        ta.push( _mapedobj.mapToObj( onesub ) );
                    }
                    v = ta;
                }
            }
            obj[ p ] = v;
        }
        return obj;
    }

    /**
     * 选择哪些字段
     * 
     * @param {*} props
     * @returns
     * @memberof ZWORM
     */
    select( ... props )
    {
        this._selectfields = {};

        for( let f of props )
        {
            this._selectfields[ this.propMapField(f) ] = 1;
        }

        return this;
    }

    /**
     * 用哪些字段排序,
     * 格式: (属性名,是否是升序,属性名,是否是升序)
     * 
     * * 比如,soryBy( 'mUserId',true,'mUserName','desc' )
     * @param {*} sorts
     * @returns
     * @memberof ZWORM
     */
    sortBy( ... sorts )
    {
        this._sortby = {};
        for( let i = 0 ; i < sorts.length ; i += 2 )
        {
            let p = sorts[i];
            let s = sorts[i+1];
            if( p != undefined && s != undefined )
            {
                let asc = (s == 'asc' || s == true ) ?1:-1
                let obj = {};
                obj[ this.propMapField(p) ] = asc;
                Object.assign(this._sortby,obj);
            }
        }
        return this;
    }

    leftJoin( joinfrom, joinfromid,joinid,joinas )
    {
        let lookup = {};
        let t = null;

        //已经添加过了,
        if( this._joinedpros.indexOf( joinas ) != -1 ) return;
        this._joinedpros.push( joinas );

        if( typeof joinfrom == 'function' )
        {
            t = new joinfrom();
        }
        else if( typeof joinfrom == 'object' )
        {
            t = joinfrom;
        }
        
        if( t )
        {
            this._aggmap[ joinas ] = t;

            joinfrom = t._tableName;
            joinid =  this.propMapField( joinid);
            joinfromid = t.propMapField( joinfromid );
            joinas = this.propMapField( joinas );
        }
        lookup.from         = joinfrom;
        lookup.localField   = joinid;
        lookup.foreignField = joinfromid;
        lookup.as           = joinas;
        if( t && t._preConvertQuery() )
        {//如果有查询条件,那么加入过滤,,
            delete lookup.localField;
            delete lookup.foreignField;

            let local_exprname = 'localField';
            let foreign_exprname = '$' + joinfromid;
            lookup.let = {};
            lookup.let[ local_exprname ] = ('$' + joinid);
            let match = { '$and': [ t._convertQuery() , {'$expr':{ '$eq':[  foreign_exprname,('$$'+local_exprname)  ] } }] };
            lookup.pipeline = [ { '$match':match } ];
            if( t._sortby )
                lookup.pipeline.push( { '$sort':t._sortby } );
            
            if( t._selectfields )//有设置选择字段
                lookup.pipeline.push( { '$project':t._selectfields  } );
        }

        let q = this._convertQuery();
        q = { '$match' : q };
        lookup = { '$lookup':lookup };
        if( this._aggregate.length == 0 )
        {
            let a = [ q,lookup];
            this._aggregate = a;
        }
        else this._aggregate.push( lookup );

        return this;
    }
    
    //替换查询对象里面的字段,合并子项查询
    _preConvertQuery( keys = null )
    {
        if( this._queryobj != null ) return this._queryobj;
        if( keys == null || keys.length == 0 )
            keys = this.getLockedProps();
        let a = [];
        for( let one of keys )
        {
            let onev = this[one];
            if( onev == undefined || !(onev instanceof ZWQuery) ) continue;
            //首先把字段名字替换了,
            onev.replaceField( this.propMapField( one ) );
            a.push( onev );
        }
        this._queryobj = ZWQuery.combinSub( a );
        return this._queryobj;
    }
    //转换为真正的查询语句
    _convertQuery( keys = null )
    {
        let q = null;
        q = this._preConvertQuery().makeQuery();
        console.log('sql:', JSON.stringify( q ) );
        return q;
    }

    _find( pageindex ,pagesize )
    {
        let itcursor = null;
        if( this._aggregate && this._aggregate.length )
            itcursor = this._dbinst.collection( this._tableName ).aggregate( this._aggregate );
        else 
        {
            let q = this._convertQuery();
            itcursor = this._dbinst.collection( this._tableName ).find( q );        
        }
        if( this._sortby )
            itcursor.sort( this._sortby );
        if( this._selectfields )
            itcursor.project( this._selectfields );
        itcursor.skip(pageindex*pagesize).limit( pagesize );
        return itcursor.toArray();
    }

    /**
     * 原生查询语句的条件
     *
     * @param {*} q
     * @returns
     * @memberof ZWORM
     */
    setOrgQuery( q )
    {
        this._queryobj = ZWQuery.Org_Query(q);
        return this;
    }
    /**
     * and 其他对象,作为查询
     *
     * @param {*} obj
     * @returns ZWORM
     * @memberof ZWORM
     */
    and( obj )
    {
        this._preConvertQuery().and('&&', obj._preConvertQuery() );
        return this;
    }

    /**
     * or 其他对象,作为查询
     *
     * @param {ZWORM} obj
     * @returns ZWORM
     * @memberof ZWORM
     */
    or( obj )
    {
        this._preConvertQuery().or('||', obj._preConvertQuery() );
        return this;
    }
    


    /**
     * 翻页查询数据 
     * 匹配条件就是属性的值
     * @param {number} [pageindex=0] 页码,0开始
     * @param {number} [pagesize=20] 页大小,默认20
     * @returns {array} 结果列表
     * @memberof ZWORM
     */
    async find( pageindex = 0,pagesize = 20 )
    {
        let arr = await this._find( pageindex,pagesize );
        let rarr = new Array();
        for( let one of arr )
        {
            rarr.push( this.mapToObj( one ) );
        }
        return Promise.resolve( rarr );
    }

    /**
     * 查询一个对象
     * 匹配条件就是属性的值
     * @returns {ZWORM} 返回结果/null
     * @memberof ZWORM
     */
    async findOne( )
    {
        let arr = await this._find(0,1)
        if( !arr || !arr.length ) return Promise.resolve( null );
        let retobj = this.mapToObj( arr[0] );
        return Promise.resolve( retobj );
    }

    /**
     * 查询一个对象,和findOne区别就是 不重新生成对象,直接填充自己
     * 
     * 匹配条件就是属性的值
     * @returns {ZWORM} 返回this/null
     * @memberof ZWORM
     */
    async fetchThis()
    {
        let obj = await this.findOne();
        Object.assign( this,obj);
        return Promise.resolve( this );
    }
    /**
     * 删除自己,删除条件就是属性的值
     * @param {*} [opt=null]
     * @returns 返回true/false
     * @memberof ZWORM
     */
    async removeThis( opt = null )
    {
        let op = opt?opt:this._saveop;
        let r = await this._dbinst.collection( this._tableName ).deleteOne( this._convertQuery(),op );
        return Promise.resolve( r.deletedCount == 1 ); 
    }

    /**
     * 删除数据
     * 条件就是属性的值作为匹配
     * @param {*} [opt=null]
     * @returns 返回删除数据条数
     * @memberof ZWORM
     */
    async deleteAll( opt = null )
    {
        let op = opt?opt:this._saveop;
        let r = await this._dbinst.collection( this._tableName ).deleteMany( this._convertQuery(),op );
        return Promise.resolve( r.deletedCount );
    }

    /**
     * 插入数据 成功之后自动添加id字段到对象
     * 
     * @param {*} [opt=null]
     * @returns{boolean} 成功/失败
     * @memberof ZWORM
     */
    async insertThis( opt = null )
    {
        //额外添加最后更新和创建时间.
        let dumpobj = this.mapToRow();
        dumpobj.createat = new Date();
        dumpobj.lastModified = new Date();
        let op = opt ? opt:this._saveop;
        let r = await this._dbinst.collection( this._tableName ).insertOne(dumpobj,op);
        if( !r || !r.insertedId ) return Promise.resolve( false );
        this[  this.getPropIdName() ] = r.insertedId;
        return Promise.resolve( true );
    }

    /**
     * 更新数据,更新条件就是属性
     * @param {ZWORM|Object} 要更新的数据 要更新的数据,原生对象或者orm对象
     * @param {*} [opt=null] 
     * @returns{int} 返回更新了多少条数据
     * @memberof ZWORM
     */
    async updateThis( u_doc  ,opt = null )
    {
        return this.updateMany( u_doc,opt,true);
    }
 
    /**
     * 更新多个数据
     * 和 updateThis 唯一区别就是更新多个或者一个
     * @param {ZWORM|Object} 要更新的数据,原生对象或者orm对象
     * @param {*} [opt=null]
     * @param {boolean} [bone=false]
     * @returns
     * @memberof ZWORM
     */
    async updateMany( u_doc , opt = null ,bone = false )
    {
        let q = this._convertQuery();
        let u = u_doc;
        if( u_doc instanceof ZWORM )
        {
            u = u_doc.mapToRow();
            u.lastModified = new Date();
            u = {'$set':u};
        }

        let op = opt ? opt:this._saveop;
        let r = null;

        if( bone )
            r = await this._dbinst.collection( this._tableName ).updateOne(q,u,op);
        else
            r = await this._dbinst.collection( this._tableName ).updateMany(q,u,op);

        if( !r ) return Promise.resolve( 0 );
        return Promise.resolve( r.modifiedCount );
    }

    async count( )
    {
        return this._dbinst.collection( this._tableName ).count( this._convertQuery() );
    }

    makeop( prop ,op ,value = null,value1 = null)
    {
        let obj = {};
        let f = this.propMapField( prop );
        obj[ f ] = value;
        switch( op )
        {
            case '-':
                obj[f] = -obj[f] ;
            case '+':
                obj = { '$inc': obj };
                break;
            case '/':
                obj[ f ] = 1.0/obj[ f ];
            case '*':
                obj = { '$mul': obj };
                break;
            case ')))':
            case 'max':
                obj = { '$max':obj };
                break;
            case '(((':
            case 'min':
                obj = { '$min':obj };
                break;
            case 'del':
                obj = {};
                obj[f] = "";
                obj = { '$unset': obj };
                break;
            case 'set':
                obj = { '$set': obj };
                break;
            
            default:
                if( op.indexOf('$') == 0 )
                {
                    let t = {};
                    t[op] = obj;
                    obj = t;
                }
                else throw new Error('unkown op !!');
            break;
        }
        return obj;
    }


    /**
     * 更新插入,如果没有对应的数据就插入新的,并且附加id在对象里面,如果已经存在就更新
     *
     * @param {ZWORM|Object} query 匹配条件,
     * @param {Array} upkeys 如果匹配到数据,要更新的部分;(如果没有就所有属性全新插入)
     * @param {*} [opt=null]
     * @returns{int} -1/0/1,-1失败,0更新成功,1新插入了数据
     * @memberof ZWORM
     */
    async upInsert( query,upkeys,opt = null )
    {
        let q = query;
        if( query instanceof ZWORM ) q = query._convertQuery();

        let u = {};
        let i = {};
        let keys = this.getLockedProps();

        for( let key of keys )
        {
            if( key == this.getPropIdName() ) continue;
            let v = this[key];
            if( upkeys.indexOf( key ) != -1 )
            {//这个是需要更新的字段
                u[ this.propMapField(key) ] = v;
            }
            else 
            {//其他都是需要全新插入的时候需要的,
                i[ this.propMapField(key) ] = v;
            }
        }

      
        let op = opt?opt:this._saveop;
        op.upsert = true;
        
        let r = await this._dbinst.collection( this._tableName ).updateOne( q ,{
             '$set':u,
             '$setOnInsert':i,
             '$currentDate': { lastModified: true }
        },op);

        if( !r || (!r.modifiedCount && !r.upsertedId ) ) return Promise.resolve( -1 );
        if( r.upsertedId )
        {
            this[ this.getPropIdName() ] = r.upsertedId._id;
            return Promise.resolve( 1 );
        }
        return Promise.resolve( 0 );
    }
    
    


}



module.exports = ZWORM;
