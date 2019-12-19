class ZWQuery
{
    constructor(field=null)
    {
        this._and_arr = new Array();
        this._or_arr = new Array();

        this._field = field;
        if( field == null )
            this._field = ZWQuery.HolderName();
    }
    static HolderName()
    {
        return '_zwquery_holder_';
    }
    static Query(op,v,field=null,v1=null)
    {
        let q = new ZWORMQuery(field);
        q._head = 0;
        return q.and(op,v,v1);
    }
    static OrQuery(op,v,field = null,v1=null)
    {
        let q = new ZWORMQuery(field);
        q._head = 1;
        return q.and(op,v,v1);
    }
    _appendq(op,value,value1)
    {
        let q = {};
        let field = this._field;
        switch( op )
        {
            case '=':
            case '$eq':
                q[field] = {'$eq':value};
                break;
            case '>':
            case '$gt':
                q[field] = {'$gt':value};
                break;
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
            case '?':
            case '$exists':
                q[field] = {'$ne':value};
                break;
            case '%':
            case '$mod':
                q[field] = {'$mod':[value,value1]};
                break;
            case 'like':
            case '$regex':
                q[field] = {'$regex':value,'options':value1};
                break;
            default:
                return null;
        }
        return q;
    }
    and(op,v,v1=null)
    {
        this._and_arr.push( this._appendq(op,v,v1) );
        return this;
    }
    or(op,v,v1=null)
    {
        this._or_arr.push( this._appendq(op,v,v1) );
    }
    makeQuery( realfieldname )
    {
        let q = {};
        if( this._field == ZWQuery.HolderName() )
        {
            for( let one of this._and_arr )
            {
                one[ realfieldname ] = one[ this._field ];
                delete one[ this._field ];
            }
            for( let one of this._or_arr )
            {
                one[ realfieldname ] = one[ this._field ];
                delete one[ this._field ];
            }
        }
        q['$and'] = this._and_arr;
        if( this._or_arr.length )
        {
            let orq = {};
            orq['$or'] = this._or_arr;
            q['$and'].push( orq );
        }
        //如果对应这个字段的查询本来就或关系
        if( this._head == 1 )
        { 
            q = { '$or':[ q ] };
            q.name = '$or';
        }
        return q;
    }

}

module.exports = ZWQuery;
