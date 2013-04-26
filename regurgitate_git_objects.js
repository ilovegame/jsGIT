//koment
fs = require('fs');
ph = require('path');
zlib = require('zlib');

var git_objs  ='./.git/objects';
var objs = fs.readdirSync(git_objs);

//console.log(objs);

var paths_to_objs = new Array();

objs.forEach(function(directory) {
    inside = fs.readdirSync((ph.join(git_objs, directory)));
    inside.forEach(function(file){
        paths_to_objs.push(ph.join(git_objs, ph.join(directory, file)));
    });
});


paths_to_objs.forEach(function(path){
    
    file = fs.readFileSync(path);
    zlib.unzip(file, function(err, buffer) {
      if (!err) {
        console.log("____________________________________________");
        console.log(path);
        console.log(buffer.toString());
      }
    });
});