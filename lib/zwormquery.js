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
        this._cond_arr = new Array();

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
    static OrQuery(op,v,field = null,v1=null)
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
            case '|':
            case '$in':
                q[field] = {'$in':value};
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
            case '!|':
            case '$nin':
                q[field] = {'$ne':value};
                break;
            case '??':
            case '$exists':
                q[field] = {'$ne':value};
                break;
            case '%':
            case '$mod'://余数
                q[field] = {'$mod':[value,value1]};
                break;
            case 'like'://模糊查询,正则表达式匹配
            case '$regex':
                q[field] = {'$regex':value,'options':value1};
                break;
            default:
                throw new Error('query unsupport ops!');
        }
        return q;
    }

    /**
     * and操作其他值
     * @param {*} op 
     * @param {*} v 
     * @param {*} v1 
     * @returns {ZWQuery} 返回this
     */
    and(op,v,v1=null)
    {
        let c = {};
        c.name = '$and';
        c.cond = this._appendq(op,v,v1);
        this._cond_arr.push( c );
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
        let c = {};
        c.name = '$or';
        c.cond = this._appendq(op,v,v1);
        this._cond_arr.push( c );
        return this;
    }

    /**
     * 生成最终的查询语句
     * @param {*} realfieldname 
     * @returns {Object} 返回最终的查询语句
     */
    makeQuery( realfieldname )
    {
        let q = {};
        q['$and'] = [];
        q['$or'] = [];
        for( let one  of this._cond_arr )
        {
            //首先做字段替换,
            let fields = Object.keys( one.cond );
            for( let f of fields )
            {
                if( realfieldname == f ) continue;//如果已经换过了,就不管了
                one.cond[ realfieldname ] = one.cond[ f ];
                delete one.cond[ f ];
            }
            q[ one.name ].push( one.cond );
        }
        q.name = '$and';
        if( q['$and'].length == 0 )
            delete q['$and'];
        if( q['$or'].length == 0 )
        {
            delete q['$or'];
        }
        else if( q['$and'] != undefined ) 
        {//如果有或 那么把and弄到或之下,
            q['$or'] = q['$or'].concat( q['$and'] );
            delete q['$and'];
            q.name = '$or';
        }
        return q;
    }
}

module.exports = ZWQuery;
