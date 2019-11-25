const globby = require("globby");
var hashFiles = require("hash-files");
const md5File = require("md5-file/promise");
var sqlite3 = require("sqlite3").verbose();
var sqlite = require("sqlite");
const SQL = require("sql-template-strings");
// var db = new sqlite3.Database("./sqlite/filehashes.db");
const path = require("path");
const fs = require("promise-fs");
var readlineSync = require("readline-sync");
var upath = require("upath");
var process = require("process");
let Client = require("ssh2-sftp-client");
let sftp = new Client();

// const fs = require("fs");

// function readSyncByfs(tips) {
//   let response;

//   tips = tips || "> ";

//   process.stdout.write(tips);

//   process.stdin.pause();
//   const buf = Buffer.allocUnsafe(10000);

//   fs.readSync(process.stdin.fd, buf, 0, 10000, 0);

//   process.stdin.end();

//   return buf.toString("utf8", 0).trim();
// }

// console.log(readSyncByfs("请输入任意字符："));
// return;

// return;
const dbPath = "./sqlite/";
(async () => {
  const config = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "./config.json"))
  );

  console.log(config);
  // var localPath = upath.normalize(
  //   readlineSync.question("please input directory path:")
  // );
  const localFiles = upath.normalize(config.localFiles);
  console.log(localFiles);
  let db;
  try {
    db = await sqlite.open(dbPath + "filehashes.db");
  } catch (e) {
    await fs.mkdir(dbPath);
    console.log(await fs.access(dbPath));
    db = await sqlite.open(dbPath + "filehashes.db");
  }
  // return;
  await sftp.connect(config.sftp);
  // console.log(await sftp.list("/archives/Books/Existing"));
  //   return;
  const table = await db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = 'filehashes';"
  );
  // console.log(table);
  if (!table) {
    await db.run(`CREATE TABLE "filehashes" ("hash"	TEXT, "filename"	TEXT)`);
  }
  // options is optional
  const files = await globby(localFiles);
  // console.log(files);
  // files is an array of filenames.
  // If the `nonull` option is set, and nothing
  // was found, then files is ["**/*.js"]
  // er is an error object or null.
  asyncForEach(files, async file => {
    const filename = path.basename(file);
    const hash = await md5File(file);
    console.log(`The MD5 sum of ${file} is: ${hash}`);

    const record = await db.get(
      SQL`SELECT hash FROM filehashes WHERE hash = ${hash}`
    );
    // console.log(record);
    if (!record) {
      const rt = await sftp.put(file, config.sftp.remotePath + filename);
      console.log(rt);
      if (rt) {
        await db.run(
          SQL`INSERT INTO filehashes (hash, filename) VALUES (${hash}, ${filename})`
        );
        if (config.deleteSource) {
          await fs.unlink(file);
        }
      }
    } else {
      if (config.deleteSource) {
        await fs.unlink(file);
      }
    }
  });
})();
setInterval(function() {
  console.log("timer that keeps nodejs processing running");
}, 1000 * 60 * 60);

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

/**
 * 文件遍历方法
 * @param filePath 需要遍历的文件路径
 */
function fileDisplay(filePath) {
  //根据文件路径读取文件，返回文件列表
  fs.readdir(filePath, function(err, files) {
    if (err) {
      console.warn(err);
    } else {
      //遍历读取到的文件列表
      files.forEach(function(filename) {
        //获取当前文件的绝对路径
        var filedir = path.join(filePath, filename);
        //根据文件路径获取文件信息，返回一个fs.Stats对象
        fs.stat(filedir, function(eror, stats) {
          if (eror) {
            console.warn("获取文件stats失败");
          } else {
            var isFile = stats.isFile(); //是文件
            var isDir = stats.isDirectory(); //是文件夹
            if (isFile) {
              console.log(filedir);
            }
            if (isDir) {
              fileDisplay(filedir); //递归，如果是文件夹，就继续遍历该文件夹下面的文件
            }
          }
        });
      });
    }
  });
}
