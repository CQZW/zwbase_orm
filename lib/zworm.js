/**
 * 对象和数据表之间的自动映射
 * 数据库操作封装,提取常用的方法
 * 添加操作增加 createat 字段
 * 更新操作增加 lastModified 字段
 * @class ZWORM
 */
const ZWQuery = require('./zwormquery');
const ObjectID = require('mongodb').ObjectID;
const Cursor = require('mongodb').Cursor;
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
    /**
     * 子类的构造函数,一定 将dbinst作为第一个参数,
     * 因为 mapToObj 里面默认将传递 dbinst作为第一个参数
     */
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
         @type {Array}
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

        this._selectfields = null;
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

        this._aggregate = [];

        this._joinedpros = [];
    }

    /**
     * 锁定要写入数据库的字段,通常构造函数 super() 之后调用
     * 调用之后,数据库 字段和属性名字的映射及数量就确定了
     * 对象增加了属性也不会写入到数据库,要增加入库字段需要在顶部定义
     * 
     * 每个类必须自己主动调用,如果在构造调用了,字段只有父类的
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
        return tt;
    }

    /**
     * 获取当前锁定的属性
     * 通常用于表明 需要输入数据库的字段,而出库由数据库返回多少就是多少,见 mapToObj
     * @param {boolean} 重新锁定字段
     * @returns {Array<string>}
     * @memberof ZWORM
     */
    getLockedProps( relock = false )
    {
        let r = this._lockedprops;
        //if( !r ) throw new Error('you do not lock your fields');
        //这里添加个懒人模式,否则子类必须主动调用 lockProps,太麻烦了
        if( !r || relock ) r = this._lockedprops = this.lockProps();
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
        return propname;
    }
    getFieldNameByPropName( propname )
    {
        let v;
        if( propname == 'createat' || propname == 'lastModified' )
            v = propname;
        else if( propname == this.getPropIdName() ) 
            v = this.getFieldIdName();
        else 
            v = this.propMapField( propname );
        return v;
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
        return fieldname;
    }

    getPropNameByFieldName( fieldname )
    {
        let v;
        if( fieldname == 'createat' || fieldname == 'lastModified' )
            v = fieldname;
        else if( fieldname == this.getFieldIdName() )
            v = this.getPropIdName();
        else 
            v = this.fieldMapProp( fieldname );
        return v;
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
     * 可以理解为主键吧,和getFieldIdName 配对使用
     * @returns {string}
     * @memberof ZWORM
     */
    getPropIdName()
    {
        return 'id';
    }

    /**
     * 获取数据库id字段名字
     * 和 getPropIdName 配对使用
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
            if( ObjectID.isValid(v) && typeof v =='string' ) v = ObjectID.createFromHexString(v); 
            dumpobj[ this.getFieldNameByPropName(key) ] = v;
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
            let p = this.getPropNameByFieldName( key );
            let v = row[ key ];
            let _mapedobj = null;
            if( this._aggmap && (_mapedobj = this._aggmap[ p ]) )
            {
                if( Array.isArray( v ) )
                {
                    let ta = [];
                    for( let onesub of v )
                    {
                        ta.push( _mapedobj.mapToObj( onesub ) );
                    }
                    v = ta;
                }
                else 
                    v = _mapedobj.mapToObj( v );
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

        for( let p of props )
        {
            this._selectfields[ this.getFieldNameByPropName(p) ] = 1;
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
                this._sortby[ this.getFieldNameByPropName(p) ] = asc;
            }
        }
        return this;
    }

    /**
     * 关联查询,左连接,如果复合查询,leftJoin放到最后
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
        //if( this.getAllWillMapProps().indexOf( joinas ) != -1 ) return null;
        //fix..这里就算同名也没关系,覆盖了吧

        this._joinedpros.push( joinas );

        //如果是zworm类型的就
        if( t )
        {
            this._aggmap[ joinas ] = t;

            joinfrom = t._tableName;
            joinid =  this.getFieldNameByPropName( joinid );
            joinfromid = t.getFieldNameByPropName( joinfromid );
            joinas = this.getFieldNameByPropName( joinas );
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

        //因为这里,所以必须自己的查询条件写到leftjion之前.
        let q = this._convertQuery();
        q = { '$match' : q };
        lookup = { '$lookup':lookup };
        let a = [];
        if( this._aggregate.length == 0 )
        {//查询条件只加入一次
            a.push ( q );
        }
        a.push( lookup );
        if( this._sortby && this._aggregate.leng == 0)
        {//排序也只加入一次
            let s = { '$sort': this._sortby };
            a.push( s );
        }
        if( unwind )
        {
            let unw = { '$unwind' : ('$'+ joinas) };
            a.push( unw );
        }
        this._aggregate = this._aggregate.concat( a );
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
            onev.replaceField( this.getFieldNameByPropName( one ) );
            a.push( onev );
        }
        //如果没有条件就是无条件,比如 coll.find({})
        if( a.length == 0 )
            this._queryobj = ZWQuery.Org_Query({});
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
        let itcursor = this.findRetCursor();
        itcursor.skip(pageindex*pagesize).limit( pagesize );
        return itcursor.toArray();
    }
    /**
     * 查询数据,返回游标
     * @returns {Cursor} 返回操作游标
     * @memberof ZWORM
     */
    findRetCursor()
    {
        //https://mongodb.github.io/node-mongodb-native/3.5/api/AggregationCursor.html#batchSize
        //https://mongodb.github.io/node-mongodb-native/3.5/api/Cursor.html
        /**
         * @type{Cursor}
         */
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
        return itcursor;
    }
    /**
     * 获取下一个对象
     * 
     * @param {Cursor} cursor
     * @memberof ZWORM
     */
    async nextObj( cursor )
    {
        if( ! await cursor.hasNext() ) return Promise.resolve( null );
        let t = await cursor.next();
        if( !t ) return Promise.resolve( null );
        return this.mapToObj( t );
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
     * @returns{Promise<number>}-1:数据重复,0:插入失败,1插入成功
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
                if( !r || !r.insertedId ) return Promise.resolve( 0 );
                this[  this.getPropIdName() ] = r.insertedId;
                return Promise.resolve( 1 );
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
                    else return Promise.resolve(-1);
                }
                else throw e;
            }
        }
    }
    /**
     *根据ID属性进行插入/更新
     * 成功之后映射最新数据到this
     * @param {*} upprops
     * @param {*} [opt=null]
     * @returns {Promise<number>} ,-2:操作失败了,0:更新数据成功,1:插入成功
     * @memberof ZWORM
     */
    async dumpThisById( upprops , opt = null )
    {
        return this._dumpThisBy( this.getPropIdName() , upprops , opt );
    }
    /**
     * 根据某个属性更新/插入数据
     * 成功之后映射最新数据到this
     * @param {string} qprop
     * @param {Array<string>} upprops
     * @param {*} [opt=null]
     * @returns {Promise<number>} ,-2:操作失败了,0:更新数据成功,1:插入成功
     * @memberof ZWORM
     */
    async _dumpThisBy( qprop  , upprops , opt = null )
    {
        //1.首先尝试直接插入,
        let r = await this.insertThis( opt );
        if( r == 1 )
        {//插入成功了
            return Promise.resolve(1);
        }
        //插入数据失败了,直接报错
        if( r != -1 ) return Promise.resolve(-2); 
        //剩下的都是 -1,数据重复了,那么就更新

        //2.更新数据
        let _old = this[ qprop ];
        this[ qprop ] = ZWQuery.Query( '==' , this[ qprop ] ) ;
        let updoc = this.mapToRow(upprops);
        let inc_f = this.getAutoIncProp();
        if( inc_f )
        { //如果有自增字段,不能更新自增字段
            inc_f = this.getFieldNameByPropName(inc_f);
            delete updoc[inc_f];
        }
        updoc = {'$set':updoc};
        let _r = await this.updateAtom( updoc );
        this[ qprop ] = _old;//还原数据
        return Promise.resolve( _r == 0 ? -2:0 );
    }

    /**
     * 通过这个对象的属性作为条件更新数据,不会自动插入新数据,属性值不是Query类型的就是要更新的数据
     * 自动剔除自增ID的更新,如果是原生语句则无法剔除
     * @param {ZWORM|{}} 要更新的数据,原生对象或者orm对象 如果=null,默认是this
     * @param {*} [opt=null] 
     * @returns{Promise<number>} 返回更新了多少条数据
     * @memberof ZWORM
     */
    async updateThis( u_doc = null ,opt = null )
    {
        let q   = this._convertQuery();
        let u   = this._makeForUpdate(u_doc);
        let r   = await this._dbinst.collection( this._tableName ).updateOne(q,u,(opt ? opt:this._saveop) );
        if( !r ) return Promise.resolve( false );
        return Promise.resolve( r.modifiedCount );
    }
 
    /**
     * 通过这个对象的属性作为条件更新数据,不会自动插入新数据, 属性值不是Query类型的就是要更新的数据
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
     * 原子更新,没有不会自动插入,属性值不是Query类型的就是要更新的数据
     * 成功会把最新数据映射到this,除非opt.returnOriginal=true,就是老数据了
     * 自动剔除自增ID的更新,如果是原生语句则无法剔除
     * @param {{}|ZWORM} [u_doc=null]
     * @param {boolean} retorg = true,默认是最新的数据
     * @param {*} [opt=null]
     * @returns{Promise<number>} -2:操作失败,-1:数据重复,0:没找到数据,1:更新成功
     * @memberof ZWORM
     */
    async updateAtom( u_doc = null, opt = null )
    {
        let q   = this._convertQuery();
        let u   = this._makeForUpdate(u_doc);
        opt = (opt ? opt:this._saveop);
        
        //如果要插入更新之类的,自定义opt传进来
        opt.upsert = false;
        if( opt.returnOriginal == undefined ) opt.returnOriginal = false;

        try
        {
            //Find a document and update it in one atomic operation. Requires a write lock for the duration of the operation.
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
                //最终没有找到要更新的数据
                return Promise.resolve( 0 );
            }
        }
        catch(e)
        {
            if( e.code == 11000 )
            {
                return Promise.resolve( -1 );
            }
            throw e;//其他错误直接异常了
        }
        return Promise.resolve( -2 );
    }
    /**
     * 原子更新/插入数据,成功会将数据映射到最新,除非opt.returnOriginal=true,就是老数据
     * @param {ZWORM|{}} query 匹配条件,可以是原生语句或者一个zworm对象作为查询条件
     * @param {Array<string>} upprops 如果数据存在,要更新的属性列表;
     * @param {*} [opt=null]
     * @returns{Promise<number>},  -2:操作失败, -1:数据重复,0更新成功,1新插入了数据
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
                        u[ this.getFieldNameByPropName(key) ] = v;
                    }
                    else 
                    {//其他都是需要全新插入的时候需要的,
                        i[ this.getFieldNameByPropName(key) ] = v;
                    }
                }

                let op = opt?opt:this._saveop;
                op.upsert = true;
                if( op.returnOriginal == undefined ) op.returnOriginal = false;
                let r = await this._dbinst.collection( this._tableName ).findOneAndUpdate( q ,{
                    '$set':u,
                    '$setOnInsert':i,
                    '$currentDate': { lastModified: true }
                },op);

                if( r && r.ok )
                {
                    if( r.lastErrorObject.upserted )
                    {//插入了数据,只需要把ID设置就行了
                        this[ this.getPropIdName() ] = r.lastErrorObject.upserted;
                        return Promise.resolve( 1 );
                    }
                    if( r.value )
                    {//更新了数据
                        this.mapToObj( r.value , this );
                        return Promise.resolve( 0 );
                    }
                }
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
                    else return Promise.resolve( -1 );//如果数据重复了
                }
                else throw e;
            }
        }
        return Promise.resolve( -2 );
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
        let f = this.getFieldNameByPropName( prop );
        let _obj ={};
        _obj[ f ] = value;
        switch( op )
        {
            case '{=}'://覆盖等于,不需要set 操作符
                this._updateops[f] = value;
                return this;
            case '=':
                obj[ '$set' ] = _obj;
                break;
            case '-':
                obj[f] = -_obj[f];
                break;
            case '+':
                obj = { '$inc': _obj };
                break;
            case '/':
                obj[ f ] = 1.0/_obj[ f ];
            case '*':
                obj = { '$mul': _obj };
                break;
            case '->|':
            case 'max':
                obj = { '$max':_obj };
                break;
            case '|<-':
            case 'min':
                obj = { '$min':_obj };
                break;
            case 'del':
                obj = {};
                obj[f] = "";
                obj = { '$unset': _obj };
                break;
            case 'push':
                obj = { '$push': _obj };
                break;
            default:
                if( op.indexOf('$') == 0 )
                {
                    let t = {};
                    t[op] = _obj;
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
     * 复制裁剪一个对象
     * 
     * @param {Array<string>} props
     * @param {number} [op=1],1:删除这些属性,2:仅保留这些属性
     * @returns {object} 返回普通的对象类型
     * @memberof ZWORM
     */
    cutObj( props  = [] , op = 1 )
    {
        let obj = {};
        let keys = Object.keys( this );//这里没有取锁定的字段,
        if( op == 2 )
        {
            keys = props;
        }
        for( let one of keys )
        {
            if( one.startsWith('_') ) continue;
            obj[ one ] = this[one];
        }
        if( op == 1 )
        {
            for( let one of props )
            {
                delete obj[one];
            }
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
        return JSON.stringify( this.cutObj() );
    }


    /**
     * 获取用于编码的字段,这里默认返回和锁定字段一样
     * 继承修改行为
     * @returns {Array<string>}
     * @memberof ZWORM
     */
    getEncodeProps()
    {
        return this.getLockedProps();
    }
    /**
     * 这里所谓编码其实就嵌入了一个类型,方便在JSON之后能够还原到真正的类型实例
     * 
     * 这里自动了实现了部分类型的处理,扩展类型,继承几个关键方法就行了
     * 
     * @returns 返回原生的对象
     * @memberof ZWORM
     */
    enCodeForDump()
    {
        let obj = {};
        let keys = this.getEncodeProps();
        for( let one of keys )
        {
            let _x      = this.enCodeObj( this[one] , 'this' );
            if( !_x ) {obj[one] = _x;continue;};
            obj[one]    = _x.r;
            if( _x._cls_zworm ) obj[ one + '_cls_zworm' ] = _x._cls_zworm;
        }
        return {r:obj,_cls_zworm:this.getClsNameByObj( this ) };
    }
    enCodeObj( obj , path )
    {
        if( !obj )  return obj;
        if( obj instanceof ZWORM )
            return obj.enCodeForDump();
        if( Array.isArray( obj) )
        {
            let a = [];
            for( let one of obj )
            {
                a.push( this.enCodeObj( one , path+'.'+one ) );
            }
            return {r:a};
        }
        let _ttypeof = typeof obj;
        if( _ttypeof =='symbol' || _ttypeof =='function' ) return null;
        if( _ttypeof == 'string' || _ttypeof == 'number' || _ttypeof == 'boolean' ) return {r:obj};

        let _tcls = this.getClsNameByObj( obj );
        if( _tcls != 'Object' ) return {r:obj,_cls_zworm:_tcls};

        let ret = {};
        let keys = Object.keys( obj );
        for( let one of keys )
        {
            let _x = this.enCodeObj( obj[one] , path+'.'+one );
            if( !_x ) {ret[one] = _x;continue;}
            ret[one] = _x.r;
            ret[one+'_cls_zworm'] = _x._cls_zworm;
        }
        return {r:ret,_cls_zworm:_tcls};
    }
    /**
     * 将编码的数据反编到自己对应的属性,
     *
     * @param {*} dumped
     * @returns {ZWORM}
     * @memberof ZWORM
     */
    decodeFromDump( dumped )
    {
        //这里由于使用的实例方法,类型可以忽略了,已经知道了类型
        if( !dumped ) return null;
        let _r = dumped.r;
        if( !_r ) return null;
        let keys = Object.keys( _r );
        for( let one of keys )
        {
            if( one.endsWith('_cls_zworm') ) continue;
            this[one] = this.decodeObj( _r [one] , _r [one + '_cls_zworm'] );
        }
        return this;
    }
    decodeObj( obj ,cls )
    {
        if( !obj ) return obj;
        if( Array.isArray( obj ) )
        {
            let a = [];
            for( let i of obj )
            {
                a.push( this.decodeObj( i.r , i._cls_zworm  ) );
            }
            return a;
        }
        //如果没有类名标签,直接返回了
        if( !cls ) return obj;
        if( cls != 'Object' ) return this.getObjByClsName( cls  , obj );
        //如果是对象,就拆开继续
        let r = {};
        let _keys = Object.keys( obj );
        for( let one of _keys )
        {
            if( one.endsWith('_cls_zworm') ) continue;
            r[ one ] = this.decodeObj( obj[one] , obj[one + '_cls_zworm' ] );
        }
        return r;
    }

    /**
     * 根据根据标签(默认是类名)名字,返回对应的实例,
     * 这里默认会搜索当前模块所有的类,
     * @param {string} clsname,类名
     * @param {*} v 数据
     * @returns {} 如果没找到对应的类,返回null ,子类可以继承继续实现
     * @memberof ZWORM
     */
    getObjByClsName( clsname , v )
    {
        //更多的类型处理,子类继承接口,主要是应对构造方式不一样的情况
        if( clsname.endsWith('_zworm') )
        {
            let _clsname = clsname.replace( /_zworm$/  , '' );
            let  _cls = this.searchClsInModuleByName( _clsname , this.getSearchClsStartAt( _clsname ) );
            if( !_cls )
            {
                console.warn('not find spec cls:',_clsname,' require it in you module');
                return null;
            }
            /**
             * @type ZWORM
             */
            let _v = new _cls( this );
            return _v.decodeFromDump( {r:v,_cls_zworm:clsname} );
        }
        //更多的全局类型获取或者其他类型,
        if( clsname == 'ObjectID' && typeof v == 'string' ) return ObjectID.createFromHexString( v );
        if( clsname == 'Date' ) return new Date( v );

        //其他情况先不管,直接返回Null,给子类处理

        return null;
    }
    /**
     * 继承修改标记这个类的字符串,默认是类名标记
     * @param {*} v
     * @param {string} path
     * @returns {string} 默认返回类名
     * @memberof ZWORM
     */
    getClsNameByObj( v ,path )
    {
        //如果是自己的类型,加个后缀
        if( v instanceof ZWORM )
            return Object.getPrototypeOf(v).constructor.name + '_zworm';
        return Object.getPrototypeOf(v).constructor.name;
    }
    /**
     * 继承修改 要搜索类名的起始模块,默认当前模块
     * 将次方法拷贝到你的模块就可以实现自动搜索了
     * @param {string} name
     * @returns
     * @memberof ZWORM
     */
    getSearchClsStartAt( clsname )
    {
        return module;
    }
    /**
     * 根据类名搜索制定的类,
     *
     * @param {string} name
     * @param {*} tagmodule,搜索的模块
     * @param {number} [dep=2],模块递归层数
     * @returns
     * @memberof ZWORM
     */
    searchClsInModuleByName( name, tagmodule , dep = 2 )
    {
        if( !tagmodule || !tagmodule.exports ) return null;
        if( typeof tagmodule.exports == 'function' )
        {
            if( tagmodule.exports.name == name ) return tagmodule.exports;
        }
        else if( typeof tagmodule.exports == 'object' )
        {//如果模块导出的是一个对象,,拆开
            let v = this._recExport( tagmodule.exports , name );
            if( v ) return v;
        }
        if( dep <= 0 ) return null;
        let v = this._recExport( tagmodule.exports , name );
        if( v ) return v;
        if( !tagmodule.children || !tagmodule.children.length ) return null;
        for( let one of tagmodule.children )
        {
            let v = this.searchClsInModuleByName( name , one ,dep-1);
            if( v ) return v;
        }
        return null;
    }
    _recExport( obj ,name )
    {
        let k = Object.keys( obj );
        for( let one of k )
        {
            let v = obj[one];
            if( typeof v == 'object' ) 
            {
                let _b = this._recExport( v ,name );
                if( _b ) return _b;
                continue;
            }
            if( typeof v != 'function' ) continue;
            if( v.name == name ) return v;
        }
        return null;
    }


    /**
     * 创建mongodb的id
     * @param {boolean} 是否返回字符串类型
     * @returns {string|ObjectID}
     * @memberof ZWORM
     */
    static createId( retstr = true )
    {
        //mongodb 唯一性问题 https://my.oschina.net/killnull/blog/748928
        let id = new ObjectID();
        if( retstr ) return id.toHexString();
        return id;
    }
    createId( retstr = true )
    {
        return ZWORM.createId(retstr); 
    }

    static toIdStr(v)
    {
        if( !ObjectID.isValid(v) ) return null;
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
        let q = { 'name' : this._tableName + '_' + this.getFieldNameByPropName( propname ) };
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
            return this.tempIndex( this.getFieldNameByPropName( incprop) + '_index', [incprop],true  );
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
            k[ this.getFieldNameByPropName( one ) ] = 1;
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
