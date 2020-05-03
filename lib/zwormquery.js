const   ObjectID    = require('mongodb').ObjectID;

/**
 * 查询是针对某个字段进行生成查询语句
 * 如果没有指定,默认有个站位的字段名称
 * 最终生成的时候替换就行了
 * 
 */

class ZWQuery
{

    /**
     * 
     * @param {string} field,字段名称,默认为空,生成的时候替换holder. 
     */
    constructor(field=null)
    {
        /**
         * 这个查询对象是以什么和其他平级字段开头的,比如是or 还是 and 
         * 0:and,1:or
         */
        this._head = 0;

        this._org_query = null;

        this._or_array = [];
        this._and_array = [];

        this._field = field;
        if( field == null )
            this._field = ZWQuery.HolderName();
    }

    /**
     * 获取站位字段名字
     */
    static HolderName()
    {
        return '_zwquery_holder_';
    }

    /**
     * 原生查询语句
     *
     * @static
     * @param { } q
     * @returns
     * @memberof ZWQuery
     */
    static Org_Query(q)
    {
        if( !q || typeof q != 'object' ) return null;
        let obj = new ZWQuery();
        obj._org_query = q;
        return obj;
    }
    /**
     * 生成一个查询对象,通过and操作连接其他字段
     * @param {string} op 操作符.见 _appendq 方法
     * @param {*} v 
     * @param {string} field 
     * @param {*} v1 更多参数
     * @returns {ZWQuery} 返回生成的查询对象
     */
    static Query(op,v,field=null,v1=null)
    {
        let q = new ZWQuery(field);
        q._head = 0;
        return q.and(op,v,v1);
    }

     /**
     * 生成一个查询对象,通过 or 操作连接其他字段
     * @param {string} op 
     * @param {*} v 
     * @param {string} field 
     * @param {*} v1 
     * @returns {ZWQuery} 返回生成的查询对象
     */
    static Or_Query(op,v,field = null,v1=null)
    {
        let q = new ZWQuery(field);
        q._head = 1;
        return q.and(op,v,v1);
    }

    _appendq(op,value,value1)
    {
        let q = {};
        let field = this._field;

        if( typeof value == 'string' && ObjectID.isValid(value) )
            value = ObjectID.createFromHexString( value );

        if( typeof value1 == 'string' && ObjectID.isValid(value1) )
            value1 = ObjectID.createFromHexString( value1 );

        if( Array.isArray( value ) )
        {
            let ta = [];
            for( let one of value )
            {
                if( typeof one == 'string' && ObjectID.isValid(one) )
                    ta.push( ObjectID.createFromHexString( one ) );
                else ta.push( one );
            }
            value = ta;
        }
        if( Array.isArray( value1 ) )
        {
            let ta = [];
            for( let one of value1 )
            {
                if( typeof one == 'string' && ObjectID.isValid(one) )
                    ta.push( ObjectID.createFromHexString( one ) );
                else ta.push( one );
            }
            value1 = ta;
        }
        
        //这里仅仅添加常用的操作,如果扩展自行 继承或者修改
        switch( op )
        {
            case '==':
            case '$eq':
                q[field] = {'$eq':value};
                break;
            case '>':
            case '$gt':
                q[field] = {'$gt':value};
                break;
            case '=>':
            case '>=':
            case '$gte':
                q[field] = {'$gte':value};
                break;
            case 'in':
            case '$in':
                q[field] = {'$in':value};
                break;
            case 'all_in':
            case '$all':
                q[field] = {'$all':value};
                break;
            case '<':
            case '$lt':
                q[field] = {'$lt':value};
                break;
            case '=<':
            case '<=':
            case '$lte':
                q[field] = {'$lte':value};
                break;
            case '!=':
            case '$ne':
                q[field] = {'$ne':value};
                break;
            case 'nin':
            case '$nin':
                q[field] = {'$nin':value};
                break;
            case '??':
            case '$exists':
                q[field] = {'$exists':value};
                break;
            case '%':
            case '$mod'://余数
                q[field] = {'$mod':[value,value1]};
                break;
            case 'like'://模糊查询,正则表达式匹配
            case '$regex':
                {
                if( value1 )
                    q[field] = {'$regex':value,'options':value1};
                else 
                    q[field] = {'$regex':value};
                }
                break;
            case '&&':
            case '||':
                q = value;
                break;
            default:
                if( op.indexOf('$') == 0 )
                {//如果是$开头,按原生操作处理
                    q[field][op] = value;
                }
                else
                    throw new Error('query unsupport ops!');
        }
        return q;
    }

    /**
     * and操作其他值
     * @param {string} op 
     * @param {*} v 
     * @param {*} v1 
     * @returns {ZWQuery} 返回this
     */
    and(op,v,v1=null)
    {
        this._and_array.push( this._appendq(op,v,v1) );
        return this;
    }

    /**
     * or 操作其他值
     * @param {*} op 
     * @param {*} v 
     * @param {*} v1 
     * @returns {ZWQuery} 返回this
     */
    or(op,v,v1=null)
    {
        this._or_array.push( this._appendq(op,v,v1) );
        return this;
    }

    /**
     * 合并同个对象下面的几个属性查询
     *
     * @static
     * @param {ZWQuery} subs
     * @returns ZWQuery
     * @memberof ZWQuery
     */
    static combinSub( subs )
    {
        if( subs == null || subs.length == 0 ) return null;
        
        let q = new ZWQuery();
        for( let one of subs )
        {
            if( one == undefined || !( one instanceof ZWQuery ) ) continue;
            if( one._head == 0 ) q.and('&&',one);
            else if( one._head == 1 ) q.or('||',one);
        }
        return q;
    }

    /**
     * 替换真正的查询的字段名称
     *
     * @param {string} realfieldname
     * @returns {ZWQuery}  返回this
     * @memberof ZWQuery
     */
    replaceField( realfieldname )
    {
        let a = this._and_array.concat( this._or_array );
        for( let one of a )
        {
            if( one[ ZWQuery.HolderName() ] == undefined ) continue;
            one[ realfieldname ] = one[ ZWQuery.HolderName() ];
            delete one[ ZWQuery.HolderName() ];
        }
        return this;
    }

    /**
     * 生成最终的查询语句
     * @returns {Object} 返回最终的查询语句
     */
    makeQuery( )
    {
        if( this._org_query ) return this._org_query;

        let t_and_arr = [];
        for( let one of this._and_array )
        {
            if( one instanceof ZWQuery )
            {
                let t_ = one.makeQuery();
                if( t_['$and'] != undefined ) t_and_arr = t_and_arr.concat(  t_['$and'] );
                else t_and_arr.push( t_ );
            }
            else 
                t_and_arr.push( one );
        }

        let t_or_arr = [];
        for( let one of this._or_array )
        {
            if( one instanceof ZWQuery )
            {
                let t_ = one.makeQuery();
                if( t_['$or'] != undefined ) t_or_arr = t_or_arr.concat( t_['$or'] );
                else t_or_arr.push( t_ );
            }
            else 
                t_or_arr.push( one );
        }
        let q = {};
        //只要有or 那么外层必须是or,,
        if( t_or_arr.length )
        {
            if( t_and_arr.length ) t_or_arr.push( {'$and':t_and_arr} );
            q = { '$or' : t_or_arr };
        }
        else if( t_and_arr.length )
        {
            q = { '$and':t_and_arr };
        }
        else throw new Error('not any query');
        return q;
    }
}

module.exports = ZWQuery;
