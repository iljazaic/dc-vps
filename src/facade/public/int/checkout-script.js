document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentId = urlParams.get('paymentId');
  if (paymentId) {
    const checkoutOptions = {
      checkoutKey: '4aa4414e0ce040459d365514bda941fe', //test
      paymentId: paymentId,
      containerId: "checkout-container-div",
      
    };
    const checkout = new Dibs.Checkout(checkoutOptions);
    checkout.on('payment-completed', function (response) {
      window.location = '/completed?paymentId='+paymentId;
    });
  } else {
    console.log("Expected a paymentId");   // No paymentId provided, 
    window.location = '/';         // go back to cart.html
  }
});


function cancelPayment(){
  console.log("cancelling the payment")
}


document.body.addEventListener('mousemove', (e) => {
  document.body.style.setProperty('--clientX', e.clientX + 'px');
  document.body.style.setProperty('--clientY', e.clientY + 'px');
});