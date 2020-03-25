/**
 * 对象和数据表之间的自动映射
 * 数据库操作封装,提取常用的方法
 * 添加操作增加 createat 字段
 * 更新操作增加 lastModified 字段
 * @class ZWORM
 */
const ZWQuery = require('./zwormquery');
const OBJECTID = require('mongodb').ObjectID;
class ZWORM
{
    //定义属性,并且设置默认值,不设置就是undefined
    //入库的数据,如果是undefined就不会入库
    //id
    //name = ''
    //phone= ''
    /**
     * 创建时间
     * @type {Date}
     */
    createat;

    /**
     * 最近修改时间
     * @type {Date}
     */
    lastModified;
    
    constructor( dbinst,tablename = null , saveop = null )
    {
        /** 
         * 自己的类型
         * @type typeof ZWORM
         */
        this._cls = Object.getPrototypeOf(this).constructor;

        this._dbinst = dbinst;

        this._saveop = saveop;
        if( saveop == null )
            this._saveop = { 'j':true,'w':1 };

        //
        /** 
         *如果不指定表名字,就是 t_ + 类名
         *@type string 
         */
        this._tableName = tablename;
        if( this._tableName == null )
            this._tableName = this._makeTableName();

        //
        /**
         *查询返回的数据字段
         *@type [] 
         */
        this._selectfields = null;
        
        //
        /** 
         *查询对象
         * @type  ZWQuery
         */
        this._queryobj = null;

        //
        /** 
         *复杂的聚合查询 
         */
        this._aggregate = [];

        //
        /** 
         *复杂查询,结果和类型的映射 
         */
        this._aggmap = {};

        /** 
         * 排序规则 
         * {filed:1,filed2:-1}
         * @type {}
         */
        this._sortby = null

        
        /** 
         * 锁定字段,用做入库字段的限制
         * @type []
         */
        this._lockedprops = null;

        //
        /**  
         * 左连接产生的属性
         * @type Array
        */
        this._joinedpros = [];


        /**
         * 生成复合更新操作语句
         */
        this._updateops = null;

    }

    /**
     * 清除数据,全部设置到undefined
     * 查询条件信息也会被清除
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

        this._updateops = null;
    }

    /**
     * 删除所有查询相关数据
     * 执行之后,如果继续调用查询相关代码,会重新生成查询语句
     * @memberof ZWORM
     */
    clearQuerys()
    {
        this._sortby = null;

        this._queryobj = null;

        this._aggregate = null;

        this._joinedpros = [];
    }

    /**
     * 锁定要写入数据库的字段,通常构造函数 super() 之后调用
     * 调用之后,数据库 字段和属性名字的映射及数量就确定了
     * 对象增加了属性也不会写入到数据库,要增加入库字段需要在顶部定义
     * 
     * 每个类必须自己主动调用,如果在构造调用了,子类没调用,字段只有父类的
     * @memberof ZWORM
     */
    lockProps()
    {
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
     * 通常用于表明 需要输入数据库的字段,而出库由数据库返回多少就是多少,见 mapToObj
     * @returns {Array<string>}
     * @memberof ZWORM
     */
    getLockedProps()
    {
        let r = this._lockedprops;
        if( !r ) throw new Error('you do not lock your fields');
        return r;
    }

    /**
     * 所有属性,包括jion的
     * 这些属性就是所有要参与映射到对象的字段
     * 表明这个对象到底要输出那些字段
     * @returns {Array<string>}
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
     * 这2个方法只是一个字符串转换规则,不判断属性是否存在
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
     * @param {string} fieldname
     * @returns {string} propname
     * @memberof ZWORM
     */
    fieldMapProp( fieldname )
    {
        if( fieldname == this.getFieldIdName() ) fieldname = this.getPropIdName();
        return fieldname;
    }

    /**
     * 返回需要自增的字段,自动为这个字段添加唯一索引,索引名称:field_index
     * 该字段实现类似mysql的自动自增
     * @returns {string}
     * @memberof ZWORM
     */
    getAutoIncProp()
    {
        return null;
    }
    /**
     * 获取id字段名字 对应 _id 
     * 可以理解为主键吧,这个字段不会走映射规则,
     * @returns {string}
     * @memberof ZWORM
     */
    getPropIdName()
    {
        return 'id';
    }

    /**
     * 获取数据库id字段名字
     * 这个字段不会走映射规则
     * @returns {string}
     * @memberof ZWORM
     */
    getFieldIdName()
    {
        return '_id';
    }

    /**
     * 将对象映射为数据库存储的字段对象
     * @param {Array<string>} props 
     * @returns { {} }
     */
    mapToRow( props = null )
    {
        let keys = this.getLockedProps();
        let dumpobj = {};  
        if( props && props.length ) keys = props;//如果有指定属性,就映射这些属性
        for( let key of keys )
        {
            // _ 开头的字段都不要
            if( key.indexOf('_') == 0 ) continue;
            let v = this[ key ];
            if( v == undefined ) continue;//未定义的数据不要,如果是null的可以要
            if( v instanceof ZWQuery ) continue;
            if( OBJECTID.isValid(v) && typeof v =='string' ) v = OBJECTID.createFromHexString(v);
            if( key == this.getPropIdName() )
                dumpobj[ this.getFieldIdName() ] = v;
            else
                dumpobj[ this.propMapField(key) ] = v;
        }
        return dumpobj;
    }
    /**
     * 将数据库一行数据,映射为一个自己类型的对象
     * 数据库->对象,最终输出多少字段由数据库对象决定,所以没有参考 lockedprops 
     * @param {{}} row 数据库的对象
     * @param {ZWORM} [mapto=null] 映射目标对象,如果null,产生新的
     * @returns {ZWORM} 返回新的一个同类型的对象
     * @memberof ZWORM
     */
    mapToObj( row ,mapto = null )
    {
        let keys = Object.keys( row );

        let obj = mapto;
        if( mapto == null ) obj = new this._cls( this._dbinst );
        for( let key of keys )
        {
            let p = null;
            let v = row[ key ];
            if( key === 'createat' || key === 'lastModified' )
            {//这2个字段直接把数据取了,不映射规则了
                obj[key] = v;
                continue;
            }
            else
            {
                if( key == this.getFieldIdName() ) p = this.getPropIdName();
                else 
                p = this.fieldMapProp(key);
            }
            
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
     * @param {string} props
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
                let asc = (s == 'asc' || s == true ) ?1:-1;
                this._sortby[ this.propMapField(p) ] = asc;
            }
        }
        return this;
    }

    /**
     * 关联查询,左连接
     *
     * @param {ZWORM|typeof ZWORM} joinfrom 被关联的类型或者对象
     * @param {string} joinfromid 被关联的属性名/字段名
     * @param {string} joinid 关联到自己的属性名/字段名(如果joinfrom是字符串这里就取做字段名)
     * @param {string} joinas 关联后的输出属性名
     * @param {boolean} unwind 是否将输出字段拆分为每条数据一个,否则就是输出字段的数组
     * @returns
     * @memberof ZWORM
     */
    leftJoin( joinfrom, joinfromid,joinid,joinas ,unwind = false )
    {
        let lookup = {};
        let t = null;

        if( typeof joinfrom == 'function' )
        {
            t = new joinfrom();
        }
        else if( joinfrom instanceof ZWORM )
        {
            t = joinfrom;
        }
        else if( typeof joinfrom !== 'string' )
        {//不是zworm对象也不是zworm构造也不是字符串,报错了
            return null;
        }
        //输出名字已经存在了,比如和我自己的属性同名了,或者已经被关联过了
        if( this.getAllWillMapProps().indexOf( joinas ) != -1 ) return null;
        this._joinedpros.push( joinas );

        //如果是zworm类型的就
        if( t )
        {
            this._aggmap[ joinas ] = t;

            joinfrom = t._tableName;
            joinid =  this.propMapField( joinid );
            joinfromid = t.propMapField( joinfromid );
            joinas = this.propMapField( joinas );
        }
        //否则传入数据就是 表名字 字段名 字段名 
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
            let s = { '$sort': this._sortby };
            let a = [ q,lookup ,s];
            if( unwind )
            {
                let unw = { '$unwind' : ('$'+ joinas) };
                a.push( unw );
            }
            this._aggregate = a;
        }
        else this._aggregate.push( lookup );

        return this;
    }
    
    /**
     * 预处理所有属性作为查询条件数据
     * 全部合并到一个查询对象
     * @param {Array<string>} [keys=null],指定处理那些属性,如果不知道就是锁定的属性
     * @returns {ZWQuery}
     * @memberof ZWORM
     */
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
            //这2个字段不需要映射
            if( one === 'createat' || one === 'lastModified' )
                onev.replaceField( one );
            else 
                onev.replaceField( this.propMapField( one ) );
            a.push( onev );
        }
        //如果没有条件就是无条件,比如 coll.find({})
        if( a.length == 0 )
            this._queryobj = ZWQuery.Org_Query("{}");
        else 
            this._queryobj = ZWQuery.combinSub( a );
        return this._queryobj;
    }
    

    /**
     * 将预处理的查询对象转换为真正的Mongo查询语句
     * @returns {{}}
     * @memberof ZWORM
     */
    _convertQuery( )
    {
        let q = null;
        q = this._preConvertQuery().makeQuery();
        //console.log('sql:', JSON.stringify( q ) );
        return q;
    }
    

    /**
     * 
     * 翻页查询数据,返回对象数组
     * 查询条件不会重复生成,翻页/排序 只是操作了 游标而已
     * @param {number} pageindex
     * @param {number} pagesize
     * @returns {[]}
     * @memberof ZWORM
     */
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
     * @param {{}} q
     * @returns {ZWORM}
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
     * @param {ZWORM} obj
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
     * 查询一个对象,返回新对象
     * 匹配条件就是属性的值
     * @returns {ZWORM} 返回结果/null
     * @memberof ZWORM
     */
    async findOne( )
    {
        let arr = await this._find(0,1);
        if( !arr || !arr.length ) return Promise.resolve( null );
        let retobj = this.mapToObj( arr[0] );
        return Promise.resolve( retobj );
    }

    /**
     * 查询一个对象,和findOne区别就是 不重新生成对象,直接填充自己
     * 
     * 匹配条件就是属性的值
     * @returns { Promise<ZWORM> } 返回this/null
     * @memberof ZWORM
     */
    async fetchThis()
    {
        let arr = await this._find(0,1);
        if( !arr || !arr.length ) return Promise.resolve( null );
        this.mapToObj( arr[0] ,this );
        return Promise.resolve( this );
    }
    /**
     * 删除自己,删除条件就是属性的值,最多只删除一条数据
     * @param {*} [opt=null]
     * @returns { Promise<boolean> } 
     * @memberof ZWORM
     */
    async removeThis( opt = null )
    {
        let op = opt?opt:this._saveop;
        let r = await this._dbinst.collection( this._tableName ).deleteOne( this._convertQuery(),op );
        this.clearQuerys();
        return Promise.resolve( r && r.deletedCount == 1 );
    }

    /**
     * 删除多条数据!!!
     * 条件就是属性的值作为匹配
     * @param {*} [opt=null]
     * @returns {Promise<number>} 返回删除数据条数
     * @memberof ZWORM
     */
    async deleteAll( opt = null )
    {
        let op = opt?opt:this._saveop;
        let r = await this._dbinst.collection( this._tableName ).deleteMany( this._convertQuery(),op );
        this.clearQuerys();
        return Promise.resolve( r.deletedCount );
    }

    /**
     * 插入数据 成功之后添加id(Object)字段
     * 属性就是需要插入的值,如果有异常会抛出来,比如数据重复
     * @param {*} [opt=null]
     * @returns{boolean} 成功/失败
     * @memberof ZWORM
     */
    async insertThis( opt = null )
    {
        while(1)
        {
            try
            {
                let incp = this.getAutoIncProp();
                if(  incp && incp.length )
                {//如果这个对象有自增ID,先获取自增ID
                    let i = await this._getNextSequence( incp );
                    this[ incp ] = i;
                }
                let dumpobj = this.mapToRow();
                dumpobj.createat = new Date();
                dumpobj.lastModified = new Date();
                let op = opt ? opt:this._saveop; 
        
                let r = await this._dbinst.collection( this._tableName ).insertOne(dumpobj,op);
                if( !r || !r.insertedId ) return Promise.resolve( false );
                this[  this.getPropIdName() ] = r.insertedId;
                return Promise.resolve( true );
            }
            catch(e)
            {/*如果是重复问题,看看是不是自增ID索引,如果是就循环下一个,直到成功为止
                code:11000
    driver:true
    errmsg:"E11000 duplicate key error collection: test.t_testuser index: _id_ dup key: { : ObjectId('5e46687c82ac3263981d165d') }"
    index:0
    message:"E11000 duplicate key error collection: test.t_testuser index: _id_ dup key: { : ObjectId('5e46687c82ac3263981d165d') }"
    name:"MongoError"*/
                if( e.code == 11000 )
                {
                    let t = this.getAutoIncIndexInfo();
                    if( t ) t = t.opt.name;
                    if( e.message.indexOf( t ) !== -1 )
                    {//如果错误信息里面说是自增索引导致的重复数据
                        //那么不处理,继续下次循环,直到成功为止
                        //console.log('inc field dup ..retry..');
                    }
                    else throw e;
                }
                else throw e;
            }
        }
    }


    /**
     * 根据ID字段更新或者插入,upInsert类似,只是实现方式不同
     * 属性就是真正的值,不再是查询语句了,这个方法估计比较常用
     * @param {Array<string>} upprops 要更新的属性列表,如果不是插入,就更新这些字段,不指定就全部
     * @param {*} [opt=null]
     * @returns{Promise<number>} -1:失败,0更新成功,1插入成功(添加id(Object))
     * @memberof ZWORM
     */
    async dumpThisById( upprops, opt = null )
    {
        try
        {
            let r = await this.insertThis( opt );

            if( r ) r = 1;
            else r = -1;

            return Promise.resolve( r );
        }
        catch( e )
        {
            if( e.code != 11000 ) return Promise.resolve(-1);
            else if( e.message.indexOf( '_id_' ) === -1 ) throw e;//如果不是id重复了,就是其他字段重复了,报错了
        }

        //走到这里,说明是插入重复了,需要更新
        let idv = this[ this.getPropIdName() ];
        if( !idv )
        {//如果没有指定ID来更新谁?通常不会,除非上面的重复是其他字段
            throw new Error('update which doc');
        }
        this[ this.getPropIdName() ] = ZWQuery.Query('==', idv );

        let updoc = this.mapToRow(upprops);
        let inc_f = this.getAutoIncProp();
        if( inc_f )
        { //如果有自增字段,不能更新自增字段
            inc_f = this.propMapField(inc_f);
            delete updoc[inc_f];
        }
        updoc = {'$set':updoc};
        let ur = await this.updateThis( updoc );
        if( ur == 0 ) ur = -1;//更新了0条数据,那就是出错了吧
        else ur = 0;

        //将ID数据还原
        this[ this.getPropIdName() ] = idv;

        return Promise.resolve(ur);
    }

    /**
     * 通过这个对象的属性作为条件更新数据,不会自动插入新数据,非条件作为更新数据如果u_doc=null
     * @param {ZWORM|{}} 要更新的数据,原生对象或者orm对象 如果=null,默认是this
     * @param {*} [opt=null] 
     * @returns{Promise<boolean>} 返回更新了多少条数据
     * @memberof ZWORM
     */
    async updateThis( u_doc = null ,opt = null )
    {
        let q   = this._convertQuery();
        let u   = this._makeForUpdate(u_doc);
        let r   = await this._dbinst.collection( this._tableName ).updateOne(q,u,(opt ? opt:this._saveop) );
        if( !r ) return Promise.resolve( false );
        return Promise.resolve( r.modifiedCount != 0 );
    }
 
    /**
     * 通过这个对象的属性作为条件更新数据,不会自动插入新数据,非条件作为更新数据如果u_doc=null
     * @param {{}|ZWORM 要更新的数据,原生对象或者orm对象,如果=null,默认是this,
     * 
     * 自动剔除自增ID的更新,如果是原生语句则无法剔除
     * @param {*} [opt=null]
     * @returns{Promise<number>}返回更新了多少条数据
     * @memberof ZWORM
     */
    async updateMany( u_doc = null , opt = null  )
    {
        let q   = this._convertQuery();
        let u   = this._makeForUpdate(u_doc);
        let r   = await this._dbinst.collection( this._tableName ).updateMany(q,u,(opt ? opt:this._saveop) );
        if( !r ) return Promise.resolve( 0 );
        return Promise.resolve( r.modifiedCount );
    }
    /**
     * 原子更新,不会自动插入,非条件作为更新数据如果u_doc=null
     * 成功会把最新数据映射到this
     * @param {{}|ZWORM} [u_doc=null]
     * @param {boolean} retorg = true,默认是最新的数据
     * @param {*} [opt=null]
     * @returns{Promise<number>} -1:失败,0:没找到数据,1:更新/插入成功
     * @memberof ZWORM
     */
    async updateAtom( u_doc = null, opt = null )
    {
        let q   = this._convertQuery();
        let u   = this._makeForUpdate(u_doc);
        opt = (opt ? opt:null);
        
        //opt.upsert = true;
        //opt.returnOriginal = false;

        try
        {
            let r   = await this._dbinst.collection( this._tableName ).findOneAndUpdate(q,u,opt);
            if( r && r.ok )
            {
                //插入更新 如果没有找到,value都是null,不论是否插入,或者是否返回老值
                //Document returned from the findAndModify command. If no documents were found, value will be null by default (returnOriginal: true), even if a document was upserted; if returnOriginal was false, the upserted document will be returned in that case.
                if( r.value )
                {
                    this.mapToObj( r.value ,this );
                    return Promise.resolve( 1 );//只要有值回来都是更新成功了
                }
                //如果没有值,但是如果指明了是 要插入的,这种情况也是更新数据了,
                if( opt && opt.upsert ) return Promise.resolve( 1 );
                //最终没有找到要更新的数据
                return Promise.resolve( 0 );
            }
        }
        catch(e)
        {
            
        }
        return Promise.resolve( -1 );
    }

    _makeForUpdate( u_doc )
    {
        //如果不指定更新数据,就更新this的数据,
        //那么 this的属性有些是查询条件,剩下的就是要更新的值
        if( u_doc == null ) u_doc = this;
        let u = u_doc;
        if( u_doc instanceof ZWORM )
        {
            //不能更新自增字段
            let t_incp = u_doc.getAutoIncProp();
            if( t_incp && t_incp.length ) u_doc[ t_incp ] = undefined;
            u = u_doc.mapToRow();
            u = {'$set':u};
        } 
        u['$currentDate'] = { lastModified: true };
        return u;
    }
    /**
     * 查询数据条数,条件就是属性
     *
     * @returns {Promise<number>}
     * @memberof ZWORM
     */
    async count( )
    {
        return this._dbinst.collection( this._tableName ).count( this._convertQuery() );
    }

    makeop( prop ,op ,value = null,value1 = null)
    {
        if( prop === this.getAutoIncProp() ) throw new Error('auto inc field can not update !!');
        if( !this._updateops ) this._updateops = {};
        let obj = {};
        let f = this.propMapField( prop );
        obj[ f ] = value;
        switch( op )
        {
            case '{=}'://覆盖等于,不需要set 操作符
                this._updateops[f] = value;
                return this;
            case '=':
                obj[ '$set' ] = obj;
                break;
            case '-':
                obj[f] = -obj[f];
            case '+':
                obj = { '$inc': obj };
                break;
            case '/':
                obj[ f ] = 1.0/obj[ f ];
            case '*':
                obj = { '$mul': obj };
                break;
            case '->|':
            case 'max':
                obj = { '$max':obj };
                break;
            case '|<-':
            case 'min':
                obj = { '$min':obj };
                break;
            case 'del':
                obj = {};
                obj[f] = "";
                obj = { '$unset': obj };
                break;
            case 'push':
                obj = { '$push': obj };
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
        let k = Object.keys( obj )[0];
        if( this._updateops[k] == undefined ) this._updateops[k] = {};
        Object.assign( this._updateops[k] , obj[k] );
        return this;
    }
    opFinal()
    {
        return this._updateops;
    }
    /**
     * 使用mongdb的upsert,数据就是属性值
     * 插入成功添加id字段
     * @param {ZWORM|{}} query 匹配条件,可以是原生语句或者一个zworm对象作为查询条件
     * @param {Array<string>} upprops 如果匹配到数据,要更新的属性列表;(如果没有就所有属性全新插入)
     * @param {*} [opt=null]
     * @returns{Promise<number>} -1/0/1,-1失败,0更新成功,1新插入了数据
     * @memberof ZWORM
     */
    async upInsert( query,upprops,opt = null )
    {
        while(1)
        {
            try
            {

                //upinsert问题 https://blog.csdn.net/jeffrey11223/article/details/80366368
                let q = query;
                if( query instanceof ZWORM ) q = query._convertQuery();

                let u = {};
                let i = {};
                let keys = this.getLockedProps();

                let incp = this.getAutoIncProp();
                if(  incp && incp.length )
                {//如果这个对象有自增ID,先获取自增ID
                    let incv = await this._getNextSequence( incp );
                    this[ incp ] = incv;
                }

                for( let key of keys )
                {
                    if( key == this.getPropIdName() ) continue;
                    let v = this[key];
                    if( v == undefined ) continue;
                    if( upprops.indexOf( key ) != -1 && key !== this.getAutoIncProp() )
                    {//这个是需要更新的字段,自动自增字段不能更新
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
            catch(e)
            {
                if( e.code == 11000 )
                {
                    let t = this.getAutoIncIndexInfo();
                    if( t ) t = t.opt.name;
                    if( e.message.indexOf( t ) !== -1 )
                    {//如果错误信息里面说是自增索引导致的重复数据
                        //那么不处理,继续下次循环,直到成功为止
                        //console.log('upsert inc field dup ..retry..');
                    }
                    else throw e;
                }
                else throw e;
            }
        }
    }


    /**
     *
     * 复制数据,_开头的内部字段过滤掉
     * @returns{ {} }
     * @memberof ZWORM
     */
    copyObj()
    {
        let obj = {};
        let keys = Object.keys( this );
        for( let one of keys )
        {
            if( one.startsWith('_') ) continue;
            obj[ one ] = this[one];
        }
        return obj;
    }
    /**
     * 自定义json转换,
     *
     * @returns {string}
     * @memberof ZWORM
     */
    toJSON()
    {
        return JSON.stringify( this.copyObj() );
    }

    /**
     * 创建mongodb的id
     * @param {boolean} 是否返回字符串类型
     * @returns {string|OBJECTID}
     * @memberof ZWORM
     */
    static createId( retstr = true )
    {
        //mongodb 唯一性问题 https://my.oschina.net/killnull/blog/748928
        let id = new OBJECTID();
        if( retstr ) return id.toHexString();
        return id;
    }
    createId( retstr = true )
    {
        return ZWORM.createId(retstr); 
    }

    static toIdStr(v)
    {
        if( !OBJECTID.isValid(v) ) return null;
        if( typeof v == 'string' ) return v;
        return v.toHexString();
    }
    toIdStr(v)
    {
        return ZWORM.toIdStr(v);
    }
    
    /**
     * 获取自动增长id
     * @param {string} propname
     * @returns {Promise<number>}
     * @memberof ZWORM
     */
    async _getNextSequence( propname )
    {
        //https://docs.mongodb.com/v3.0/tutorial/create-an-auto-incrementing-field/
        let q = { 'name' : this._tableName + '_' + this.propMapField( propname ) };
        let u = { '$inc': { seq: 1 } };
        let opt = {returnOriginal:false,upsert:true};//返回新的数据
        let r = await this._dbinst.collection('t_zworm_counters').findOneAndUpdate( q,u,opt );
        return r.value.seq;
    }
    

    /**
     * 返回自动增长ID 索引
     * 如果没有就 null
     * @returns {{}}
     * @memberof ZWORM
     */
    getAutoIncIndexInfo()
    {
        let incprop = this.getAutoIncProp();
        if(  incprop && incprop.length )
        {//如果有自动增长字段,自动创建唯一索引
            return this.tempIndex( this.propMapField( incprop) + '_index', [incprop],true  );
        }
        return null;
    }
    /**
     * 
     * 根据模板创建常用索引
     * @param {string} name
     * @param {Array<string>} props
     * @param {boolean} unique
     * @returns {{}}
     * @memberof ZWORM
     */
    tempIndex(name, props ,unique  )
    {
        let obj = {};
        let k   = {};

        for( let one of props )
        {
            k[ this.propMapField( one ) ] = 1;
        }
        obj.key = k;
        let opt = {};
        opt.w = 1;
        opt.j = true;
        opt.unique = unique;
        opt.sparse = true;//默认都用稀疏索引吧
        opt.name = name;
        obj.opt = opt;
        return obj;
    }
    /**
     * 返回要创建的索引
     * @returns{Array}
     * @memberof ZWORM
     */
    indexInfo()
    {
        //https://docs.mongodb.com/manual/reference/command/createIndexes/

        //mongodb 索引 https://www.jianshu.com/p/2b09821a365d
        //部分索引 partial index    https://blog.csdn.net/leshami/article/details/53895973
        //稀疏索引 sparse index     https://blog.csdn.net/fansenjun/article/details/85647734




        /* 一个例子 field1 + field2 组成唯一索引
        let key = { field1:1,field2:0 };
        let opt = { name:'index_name','j':true,'w':1,unique:true ,background:false };
        let oneindex = { 'key':key,'opt':opt };
        return [ oneindex ,.... ];*/
        let a = [];
        let t = this.getAutoIncIndexInfo();
        if( t ) a.push( t );
        return a;
    }

    /**
     *安装索引,通常用于项目第一次安装,所有不会后台添加索引 
     * 返回成功失败
     * @returns {Proimse<boolean>}
     * @memberof ZWORM
     */
    async installIndex( )
    {
        try
        {
            let a = this.indexInfo();
            if( !a || !a.length ) return Promise.resolve( true );
            for( let oneindex of a )
            {
                if( await this._dbinst.collection( this._tableName ).indexExists( oneindex.opt.name ) ) 
                    continue;
                if( !await this._dbinst.collection( this._tableName ).createIndex( oneindex.key , oneindex.opt ) )
                    return Promise.resolve( false );
            }
            return Promise.resolve( true );
        }
        catch(e)
        {
            //索引已经存在了,可以认为是成功了
            if( e.code == 85 ) return Promise.resolve( true );
            throw e;
        }
    }

}



module.exports = ZWORM;
