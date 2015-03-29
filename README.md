# MyNoSQL
This node script simply reads data from MySQL tables and writes them to MongoDB collections.  
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

