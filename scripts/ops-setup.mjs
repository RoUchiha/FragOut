// Local operator bootstrap. --keys creates only recovery material. --reader is
// a separate credential setup step, used only after explicit authorization.
import {generateKeyPairSync,createPublicKey,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createVaultEscrow} from '../src/lib/backups.ts';
import {protectPrivateDirectory} from '../src/lib/private-directory.ts';

const root=resolve('.'),ops=resolve('../../work/fragout-ops'),privateDir=join(ops,'private'),keyDir=join(ops,'recovery'),backups=join(ops,'backups');
const configPath=join(privateDir,'operator.json'),readerPath=join(privateDir,'reader.json'),keyPath=join(keyDir,'recovery.pem'),publicPath=join(root,'ops/backup-public.pem');
const readerSetup=process.argv.includes('--reader');
if(!readerSetup&&!process.argv.includes('--keys'))throw new Error('Choose --keys or the separately authorized --reader setup.');
let readerPassword;
if(readerSetup){
 if(existsSync(readerPath))throw new Error('Reader configuration already exists. Use a deliberate credential-rotation procedure.');
 process.stdin.setEncoding('utf8');if(process.stdin.isTTY)process.stdin.setRawMode(true);
 console.log('Waiting for protected operator setup input.');let input='';
 for await(const chunk of process.stdin){if(chunk.includes('\u0003'))process.exit(1);input+=chunk;if(input.length>2048)throw new Error('Invalid setup input.');if(/[\r\n]/.test(input))break;}
 if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();
 ({readerPassword}=JSON.parse(input));input='';
 if(typeof readerPassword!=='string'||! /^[a-f\d]{64}$/.test(readerPassword))throw new Error('Invalid reader credential.');
}
process.loadEnvFile(resolve('../../work/fragout-cloud/private/connection.env'));
const source=new URL(process.env.FRAGOUT_DATABASE_URL),vault=Buffer.from(process.env.FRAGOUT_VAULT_KEY??'','base64');
if(!source.hostname.endsWith('.pooler.supabase.com')||source.port!=='5432'||vault.length!==32)throw new Error('Use the verified private production connection file.');
if(readerSetup){source.username='fragout_backup_reader.'+source.username.split('.').at(-1);source.password=readerPassword;source.search='';source.hash='';}
mkdirSync(privateDir,{recursive:true,mode:0o700});mkdirSync(keyDir,{recursive:true,mode:0o700});mkdirSync(backups,{recursive:true,mode:0o700});mkdirSync(join(root,'ops'),{recursive:true});
let publicKey;
if(existsSync(keyPath))publicKey=createPublicKey(readFileSync(keyPath)).export({type:'spki',format:'pem'}).toString();
else{
 const pair=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 writeFileSync(keyPath,pair.privateKey,{flag:'wx',mode:0o600});publicKey=pair.publicKey;
}
protectPrivateDirectory(keyPath);
if(existsSync(publicPath)&&readFileSync(publicPath,'utf8')!==publicKey)throw new Error('The existing backup public key does not match this recovery key.');
if(!existsSync(publicPath))writeFileSync(publicPath,publicKey,{flag:'wx'});
const vaultKeyId=createHash('sha256').update(vault).digest('hex');
const escrowPath=join(backups,'vault-'+vaultKeyId+'.fragvault');
if(!existsSync(escrowPath))writeFileSync(escrowPath,createVaultEscrow(vault,publicKey),{flag:'wx',mode:0o600});vault.fill(0);
const config={readerPath,vaultKeyId,publicKeyPath:publicPath,recoveryKeyPath:keyPath,backupRoot:backups,blobEnvironmentPath:join(privateDir,'blob.env'),testDatabasePath:resolve('../../work/fragout-test/data/fragout.sqlite')};
if(!existsSync(configPath))writeFileSync(configPath,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});
if(readerSetup)writeFileSync(readerPath,JSON.stringify({sourceUrl:source.toString()},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(readerSetup?'Authorized read-only source configuration saved privately.':'Recovery key and encrypted vault escrow prepared; no production login credential created or transferred.');
process.exit(0);
