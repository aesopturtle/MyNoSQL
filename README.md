# MyNoSQL
In general, NoSQL is by no means to replace SQL.
However, in some circumstances, we may need to dump the whole SQL data into NoSQL.
This node script just does that. It simply reads data from MySQL tables and writes them to MongoDB collections.
The input can be in the form of the followings:  
* String of a source table name.  
  For example,  
```
    'member'
```
* Array of source table names.  
  For example,  
```
    ['member', 'book', 'article']
```
 
* Object with the source MySQL table names as keys and destination MongoDB collection names as values.  
  For example,  
```
    {
        'member': 'Member',  
        'book': 'Publication',  
        'article': 'Article'  
    }
```

The returned object is of a Q.promise type which can be used to perform further operations upon done, error, etc.

## Database Configuration
The database configuration is specified in [config.js].

## Example
Please take a look at [example.js] for how to call the module.