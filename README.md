# MyNoSQL
This node script simply reads data from MySQL tables and writes them to MongoDB collections.
The input can be in the form of the followings:
1. string of a source table name.
    For example, 'member'.
2. array of source table names.
    For example, \['member', 'book', 'article'\].
3. object with the source MySQL table names as keys and destination MongoDB collection names as values.
    For example, { 'member': 'Member', 'book': 'Publication', 'article': 'Article' }.

The returned object is of a Q.promise type which can be used to perform further operations upon done, error, etc.

