var chai = require('chai');
var chaiHttp = require('chai-http');
var server = ''; //steamapi url 
var should = chai.should();

chai.use(chaiHttp);

 describe('APIQuery', function() {
  it('should list ALL steamgames on a large profile on /steamapi GET', function(done) {
  chai.request(server)
    .get('/blobs')
    .end(function(err, res){
      res.should.have.status(200);
      done();
    });
});
  it('should list a SINGLE blob on /blob/<id> GET');
  it('should add a SINGLE blob on /blobs POST');
  it('should update a SINGLE blob on /blob/<id> PUT');
  it('should delete a SINGLE blob on /blob/<id> DELETE');
});